import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Users2,
  Receipt,
  History,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  DollarSign,
  Briefcase,
  PlayCircle,
  Trash2,
  Edit,
  ShieldCheck,
  CheckCheck,
  Coins,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { PainelVerbas } from '@/components/PainelVerbas'
import { useAuth } from '@/contexts/AuthContext'
import { dpService, type CreateFuncionarioInput } from '@/services/dp'
import { esocialService, type ConformidadeFuncionario } from '@/services/esocial'
import { empresasService } from '@/services/empresas'
import { PainelEsocial } from '@/components/PainelEsocial'
import { PainelReinfDctfweb } from '@/components/PainelReinfDctfweb'
import { PainelFeriasDecimo } from '@/components/PainelFeriasDecimo'
import { FichaColaboradorModal } from '@/components/FichaColaboradorModal'
import { PainelRescisoes } from '@/components/PainelRescisoes'
import { Palmtree, UserMinus, Bus, Scale } from 'lucide-react'
import { PainelBeneficios } from '@/components/PainelBeneficios'
import { PainelConvencoes } from '@/components/PainelConvencoes'
import { beneficiosService } from '@/services/beneficios'
import { convencoesService } from '@/services/convencoes'
import type {
  Funcionario,
  FolhaPagamento,
  EventoDp,
  Empresa,
  FuncionarioStatus,
  FuncionarioTipo,
  EventoDpTipo,
  GrauInstrucaoEsocial,
  RacaCorEsocial,
  EstadoCivilEsocial,
  BeneficioConcedidoRecord,
  ConvencaoColetivaRecord,
  HistoricoSalarialRecord,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { maskCpf, isValidCpf, formatDatePtBr } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export default function DepartamentoPessoal() {
  const { tenant, member } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<
    | 'funcionarios'
    | 'folha'
    | 'ferias_decimo'
    | 'rescisoes'
    | 'verbas'
    | 'beneficios'
    | 'convencoes'
    | 'eventuais'
    | 'esocial'
    | 'reinf_dctfweb'
  >('funcionarios')
  const [expandedFolhaId, setExpandedFolhaId] = useState<string | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros Globais
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('todas')

  // === Aba 1: Funcionários ===
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [buscaFuncionario, setBuscaFuncionario] = useState('')
  const [filtroStatusFunc, setFiltroStatusFunc] = useState<string>('todos')
  const [modalFuncOpen, setModalFuncOpen] = useState(false)
  const [editingFuncionario, setEditingFuncionario] = useState<Funcionario | null>(null)
  const [fichaColaboradorId, setFichaColaboradorId] = useState<string | null>(null)
  const [fichaColaboradorOpen, setFichaColaboradorOpen] = useState(false)

  // Form Funcionário
  const [formFuncEmpresa, setFormFuncEmpresa] = useState('')
  const [formFuncNome, setFormFuncNome] = useState('')
  const [formFuncCpf, setFormFuncCpf] = useState('')
  const [formFuncCargo, setFormFuncCargo] = useState('')
  const [formFuncAdmissao, setFormFuncAdmissao] = useState('')
  const [formFuncSalario, setFormFuncSalario] = useState('')
  const [formFuncTipo, setFormFuncTipo] = useState<FuncionarioTipo>('clt')
  const [formFuncStatus, setFormFuncStatus] = useState<FuncionarioStatus>('ativo')
  const [formFuncCentroCusto, setFormFuncCentroCusto] = useState('')
  // Campos e-Social do Funcionário
  const [formFuncNisPis, setFormFuncNisPis] = useState('')
  const [formFuncCtpsNum, setFormFuncCtpsNum] = useState('')
  const [formFuncCtpsSerie, setFormFuncCtpsSerie] = useState('')
  const [formFuncCtpsUf, setFormFuncCtpsUf] = useState('')
  const [formFuncCbo, setFormFuncCbo] = useState('')
  const [formFuncGrauInstr, setFormFuncGrauInstr] = useState<string>('superior_completo')
  const [formFuncRacaCor, setFormFuncRacaCor] = useState<string>('branca')
  const [formFuncEstadoCivil, setFormFuncEstadoCivil] = useState<string>('solteiro')
  const [formFuncSexo, setFormFuncSexo] = useState<'M' | 'F'>('M')
  const [formFuncNomeMae, setFormFuncNomeMae] = useState('')
  const [formFuncDepIrrf, setFormFuncDepIrrf] = useState('0')
  const [formFuncMatricula, setFormFuncMatricula] = useState('')
  const [savingFunc, setSavingFunc] = useState(false)

  // === Aba 2: Folha de Pagamento ===
  const [folhaRecords, setFolhaRecords] = useState<FolhaPagamento[]>([])
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>('09/2026')
  const [processingFolha, setProcessingFolha] = useState(false)

  // === Novas Abas: Benefícios (VT/VA/VR) e Convenções Coletivas ===
  const [beneficios, setBeneficios] = useState<BeneficioConcedidoRecord[]>([])
  const [convencoes, setConvencoes] = useState<ConvencaoColetivaRecord[]>([])
  const [historicosSalariais, setHistoricosSalariais] = useState<HistoricoSalarialRecord[]>([])

  // === Aba 3: Eventos DP ===
  const [eventos, setEventos] = useState<EventoDp[]>([])
  const [filtroTipoEvento, setFiltroTipoEvento] = useState<string>('todos')
  const [modalEventoOpen, setModalEventoOpen] = useState(false)
  const [formEventoEmpresa, setFormEventoEmpresa] = useState('')
  const [formEventoFunc, setFormEventoFunc] = useState('')
  const [formEventoTipo, setFormEventoTipo] = useState<EventoDpTipo>('ferias')
  const [formEventoData, setFormEventoData] = useState('')
  const [formEventoDesc, setFormEventoDesc] = useState('')
  const [savingEvento, setSavingEvento] = useState(false)

  const canManage = member?.perfil === 'administrador' || member?.perfil === 'contador'

  // Carregar dados gerais
  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const [emps, funcs, folha, evts, bens, convs, hists] = await Promise.all([
        empresasService.list(tenant.id),
        dpService.listFuncionarios(tenant.id, {
          empresaId: selectedEmpresaId,
          status: filtroStatusFunc,
          busca: buscaFuncionario,
        }),
        dpService.listFolha(tenant.id, {
          empresaId: selectedEmpresaId,
          competencia: selectedCompetencia,
        }),
        dpService.listEventos(tenant.id, {
          empresaId: selectedEmpresaId,
          tipo: filtroTipoEvento,
        }),
        beneficiosService.listBeneficios(tenant.id, {
          empresaId: selectedEmpresaId,
          competencia: selectedCompetencia,
        }),
        convencoesService.listConvencoes(tenant.id, selectedEmpresaId),
        convencoesService.listHistoricoSalarial(tenant.id, {
          empresaId: selectedEmpresaId,
        }),
      ])
      setEmpresas(emps)
      setFuncionarios(funcs)
      setFolhaRecords(folha)
      setEventos(evts)
      setBeneficios(bens)
      setConvencoes(convs)
      setHistoricosSalariais(hists)
    } catch (err) {
      console.error('Erro ao carregar DP:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar módulo',
        description: 'Não foi possível buscar as informações de Departamento Pessoal.',
      })
    } finally {
      setLoading(false)
    }
  }, [
    tenant?.id,
    selectedEmpresaId,
    filtroStatusFunc,
    buscaFuncionario,
    selectedCompetencia,
    filtroTipoEvento,
    toast,
  ])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Abrir Modal de Funcionário
  const handleOpenFuncModal = (func?: Funcionario) => {
    if (func) {
      setEditingFuncionario(func)
      setFormFuncEmpresa(func.empresa)
      setFormFuncNome(func.nome_completo)
      setFormFuncCpf(maskCpf(func.cpf))
      setFormFuncCargo(func.cargo)
      setFormFuncAdmissao(func.data_admissao ? func.data_admissao.slice(0, 10) : '')
      setFormFuncSalario(String(func.salario || ''))
      setFormFuncTipo(func.tipo)
      setFormFuncStatus(func.status)
      setFormFuncCentroCusto(func.centro_custo || '')
      setFormFuncNisPis(func.nis_pis || '')
      setFormFuncCtpsNum(func.ctps_numero || '')
      setFormFuncCtpsSerie(func.ctps_serie || '')
      setFormFuncCtpsUf(func.ctps_uf || 'SP')
      setFormFuncCbo(func.cbo || '')
      setFormFuncGrauInstr(func.grau_instrucao || 'superior_completo')
      setFormFuncRacaCor(func.raca_cor || 'branca')
      setFormFuncEstadoCivil(func.estado_civil || 'solteiro')
      setFormFuncSexo(func.sexo || 'M')
      setFormFuncNomeMae(func.nome_mae || '')
      setFormFuncDepIrrf(String(func.dependentes_irrf || 0))
      setFormFuncMatricula(func.matricula_esocial || '')
    } else {
      setEditingFuncionario(null)
      setFormFuncEmpresa(selectedEmpresaId !== 'todas' ? selectedEmpresaId : empresas[0]?.id || '')
      setFormFuncNome('')
      setFormFuncCpf('')
      setFormFuncCargo('')
      setFormFuncAdmissao(new Date().toISOString().slice(0, 10))
      setFormFuncSalario('')
      setFormFuncTipo('clt')
      setFormFuncStatus('ativo')
      setFormFuncCentroCusto('')
      setFormFuncNisPis('')
      setFormFuncCtpsNum('')
      setFormFuncCtpsSerie('')
      setFormFuncCtpsUf('SP')
      setFormFuncCbo('')
      setFormFuncGrauInstr('superior_completo')
      setFormFuncRacaCor('branca')
      setFormFuncEstadoCivil('solteiro')
      setFormFuncSexo('M')
      setFormFuncNomeMae('')
      setFormFuncDepIrrf('0')
      setFormFuncMatricula('')
    }
    setModalFuncOpen(true)
  }

  // Salvar Funcionário
  const handleSaveFuncionario = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id) return

    if (!isValidCpf(formFuncCpf)) {
      toast({
        variant: 'destructive',
        title: 'CPF Inválido',
        description: 'Por favor, digite um número de CPF válido com 11 dígitos.',
      })
      return
    }

    const salarioNum = parseFloat(formFuncSalario.replace(',', '.')) || 0
    if (salarioNum <= 0) {
      toast({
        variant: 'destructive',
        title: 'Salário inválido',
        description: 'Informe um valor de salário maior que zero.',
      })
      return
    }

    setSavingFunc(true)
    try {
      if (editingFuncionario) {
        await dpService.updateFuncionario(editingFuncionario.id, {
          empresa: formFuncEmpresa,
          nome_completo: formFuncNome.trim(),
          cpf: formFuncCpf,
          cargo: formFuncCargo.trim(),
          data_admissao: new Date(`${formFuncAdmissao}T12:00:00Z`).toISOString(),
          salario: salarioNum,
          tipo: formFuncTipo,
          status: formFuncStatus,
          centro_custo: formFuncCentroCusto.trim() || undefined,
          nis_pis: formFuncNisPis.trim() || undefined,
          ctps_numero: formFuncCtpsNum.trim() || undefined,
          ctps_serie: formFuncCtpsSerie.trim() || undefined,
          ctps_uf: formFuncCtpsUf.trim() || undefined,
          cbo: formFuncCbo.trim() || undefined,
          grau_instrucao: formFuncGrauInstr as GrauInstrucaoEsocial,
          raca_cor: formFuncRacaCor as RacaCorEsocial,
          estado_civil: formFuncEstadoCivil as EstadoCivilEsocial,
          sexo: formFuncSexo,
          nome_mae: formFuncNomeMae.trim() || undefined,
          dependentes_irrf: parseInt(formFuncDepIrrf, 10) || 0,
          matricula_esocial: formFuncMatricula.trim() || undefined,
        })
        toast({
          title: 'Colaborador atualizado',
          description: `${formFuncNome} salvo com sucesso com dados de conformidade e-Social.`,
        })
      } else {
        const input: CreateFuncionarioInput = {
          tenant_id: tenant.id,
          empresa: formFuncEmpresa,
          nome_completo: formFuncNome.trim(),
          cpf: formFuncCpf,
          cargo: formFuncCargo.trim(),
          data_admissao: new Date(`${formFuncAdmissao}T12:00:00Z`).toISOString(),
          salario: salarioNum,
          tipo: formFuncTipo,
          status: formFuncStatus,
          centro_custo: formFuncCentroCusto.trim() || undefined,
          nis_pis: formFuncNisPis.trim() || undefined,
          ctps_numero: formFuncCtpsNum.trim() || undefined,
          ctps_serie: formFuncCtpsSerie.trim() || undefined,
          ctps_uf: formFuncCtpsUf.trim() || undefined,
          cbo: formFuncCbo.trim() || undefined,
          grau_instrucao: formFuncGrauInstr,
          raca_cor: formFuncRacaCor,
          estado_civil: formFuncEstadoCivil,
          sexo: formFuncSexo,
          nome_mae: formFuncNomeMae.trim() || undefined,
          dependentes_irrf: parseInt(formFuncDepIrrf, 10) || 0,
          matricula_esocial: formFuncMatricula.trim() || undefined,
        }
        await dpService.createFuncionario(input)
        toast({
          title: 'Admissão cadastrada!',
          description: `Novo colaborador ${formFuncNome} inserido no quadro ativo.`,
        })
      }
      setModalFuncOpen(false)
      loadData()
    } catch (err) {
      console.error('Erro ao salvar funcionário:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Verifique os dados e tente novamente.',
      })
    } finally {
      setSavingFunc(false)
    }
  }

  // Deletar funcionário
  const handleDeleteFuncionario = async (id: string, nome: string) => {
    if (!window.confirm(`Deseja realmente remover o colaborador ${nome}?`)) return
    try {
      await dpService.deleteFuncionario(id)
      toast({
        title: 'Registro removido',
        description: `${nome} foi excluído da base.`,
      })
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o funcionário.',
      })
    }
  }

  // Processar Folha
  const handleProcessarFolha = async () => {
    if (!tenant?.id) return
    if (selectedEmpresaId === 'todas') {
      toast({
        variant: 'destructive',
        title: 'Selecione uma empresa',
        description: 'Para processar a folha, selecione uma empresa específica no filtro.',
      })
      return
    }

    setProcessingFolha(true)
    try {
      const res = await dpService.processarFolhaCompetencia(
        tenant.id,
        selectedEmpresaId,
        selectedCompetencia,
      )
      if (res.gerados === 0) {
        toast({
          title: 'Folha já processada',
          description: `Nenhum novo registro gerado. Todos os funcionários já possuem folha para ${selectedCompetencia}.`,
        })
      } else {
        toast({
          title: 'Folha processada com sucesso!',
          description: `${res.gerados} colaboradores calculados. Impostos retidos (DARF/FGTS) gerados automaticamente no Financeiro!`,
        })
      }
      loadData()
    } catch (err) {
      console.error('Erro ao processar folha:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao processar',
        description: 'Falha no cálculo da folha de pagamento.',
      })
    } finally {
      setProcessingFolha(false)
    }
  }

  // Marcar folha como paga
  const handleMarcarFolhaPaga = async (id: string) => {
    try {
      await dpService.marcarFolhaPaga(id)
      toast({
        title: 'Folha quitada',
        description: 'Status atualizado para PAGA. Impostos retidos sincronizados.',
      })
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: 'Não foi possível marcar como paga.',
      })
    }
  }

  // Pagar lote completo da competência
  const handlePagarLote = async () => {
    const pendentes = folhaRecords.filter((f) => f.status !== 'paga')
    if (pendentes.length === 0) {
      toast({ title: 'Todos os registros já estão pagos!' })
      return
    }
    if (!window.confirm(`Deseja marcar ${pendentes.length} pagamentos como QUITADOS?`)) return

    try {
      await dpService.marcarLoteFolhaPaga(pendentes.map((p) => p.id))
      toast({
        title: 'Lote de folha liquidado',
        description: `${pendentes.length} pagamentos foram marcados como pagos.`,
      })
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao liquidar lote',
        description: 'Falha na atualização.',
      })
    }
  }

  // Abrir Modal de Evento DP
  const handleOpenEventoModal = () => {
    setFormEventoEmpresa(selectedEmpresaId !== 'todas' ? selectedEmpresaId : empresas[0]?.id || '')
    setFormEventoFunc(funcionarios[0]?.id || '')
    setFormEventoTipo('ferias')
    setFormEventoData(new Date().toISOString().slice(0, 10))
    setFormEventoDesc('')
    setModalEventoOpen(true)
  }

  // Salvar Evento DP
  const handleSaveEvento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || !formEventoFunc) return

    setSavingEvento(true)
    try {
      await dpService.createEvento({
        tenant_id: tenant.id,
        empresa: formEventoEmpresa,
        funcionario: formEventoFunc,
        tipo: formEventoTipo,
        data_evento: new Date(`${formEventoData}T12:00:00Z`).toISOString(),
        descricao: formEventoDesc.trim(),
      })
      toast({
        title: 'Evento registrado',
        description: `Evento de ${formEventoTipo} inserido com sucesso.`,
      })
      setModalEventoOpen(false)
      loadData()
    } catch (err) {
      console.error('Erro ao salvar evento:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar evento',
        description: 'Verifique se os campos estão preenchidos.',
      })
    } finally {
      setSavingEvento(false)
    }
  }

  // Totais da folha selecionada
  const folhaTotais = useMemo(() => {
    let bruto = 0
    let inss = 0
    let irrf = 0
    let fgts = 0
    let liquido = 0

    folhaRecords.forEach((f) => {
      let b = f.salario_base || 0
      if (f.proventos) {
        try {
          const arr = typeof f.proventos === 'string' ? JSON.parse(f.proventos) : f.proventos
          if (Array.isArray(arr) && arr.length > 0) {
            b = arr.reduce((acc: number, cur: { valor?: number }) => acc + (cur.valor || 0), 0)
          }
        } catch {
          /* intentionally ignored */
        }
      }
      bruto += b
      inss += f.inss || 0
      irrf += f.irrf || 0
      fgts += f.fgts || 0
      liquido += f.total_liquido || 0
    })

    return { bruto, inss, irrf, fgts, liquido, totalEncargos: inss + irrf + fgts }
  }, [folhaRecords])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
              Departamento Pessoal (DP)
            </h2>
            <Badge className="bg-[#0FA3A3] text-white text-[11px] font-semibold">P1</Badge>
          </div>
          <p className="text-xs text-[#64748B]">
            Gestão de colaboradores ativos, cálculo de folha de pagamento CLT/PJ e ocorrências
            eventuais
          </p>
        </div>

        {/* Filtro de Empresa Global */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#64748B]" />
            <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
              <SelectTrigger className="w-56 h-9 text-xs rounded-xl bg-white border-[#E2E8F0]">
                <SelectValue placeholder="Selecione a Empresa" />
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
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="w-full"
      >
        <TabsList className="bg-slate-200/60 p-1 rounded-xl h-10 w-full sm:w-auto">
          <TabsTrigger value="funcionarios" className="gap-2 text-xs font-semibold rounded-lg">
            <Users2 className="h-4 w-4" />
            <span>Colaboradores ({funcionarios.length})</span>
          </TabsTrigger>
          <TabsTrigger value="folha" className="gap-2 text-xs font-semibold rounded-lg">
            <Receipt className="h-4 w-4" />
            <span>Folha de Pagamento</span>
          </TabsTrigger>
          <TabsTrigger value="ferias_decimo" className="gap-2 text-xs font-semibold rounded-lg">
            <Palmtree className="h-4 w-4 text-emerald-600" />
            <span>Férias &amp; 13º (CLT)</span>
          </TabsTrigger>
          <TabsTrigger value="rescisoes" className="gap-2 text-xs font-semibold rounded-lg">
            <UserMinus className="h-4 w-4 text-rose-600" />
            <span>Rescisão Contratual</span>
          </TabsTrigger>
          <TabsTrigger value="verbas" className="gap-2 text-xs font-semibold rounded-lg">
            <Coins className="h-4 w-4 text-[#0FA3A3]" />
            <span>Verbas & Descontos (CLT)</span>
          </TabsTrigger>
          <TabsTrigger value="beneficios" className="gap-2 text-xs font-semibold rounded-lg">
            <Bus className="h-4 w-4 text-sky-600" />
            <span>Benefícios (VT / VA / VR)</span>
            {beneficios.length > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
                {beneficios.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="convencoes" className="gap-2 text-xs font-semibold rounded-lg">
            <Scale className="h-4 w-4 text-amber-600" />
            <span>Convenções Coletivas</span>
            {convencoes.some((c) => c.status_vigencia !== 'vigente') && (
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger value="eventuais" className="gap-2 text-xs font-semibold rounded-lg">
            <History className="h-4 w-4" />
            <span>Eventuais & Timeline</span>
          </TabsTrigger>
          <TabsTrigger value="esocial" className="gap-2 text-xs font-semibold rounded-lg">
            <ShieldCheck className="h-4 w-4 text-[#0FA3A3]" />
            <span>e-Social (S-1.1)</span>
          </TabsTrigger>
          <TabsTrigger value="reinf_dctfweb" className="gap-2 text-xs font-semibold rounded-lg">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>EFD-Reinf & DCTFWeb</span>
          </TabsTrigger>
        </TabsList>

        {/* === TAB 1: FUNCIONÁRIOS === */}
        <TabsContent value="funcionarios" className="space-y-4 mt-4">
          {/* Barra de Filtros e Novo Colaborador */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-3 rounded-2xl border border-[#E2E8F0] shadow-2xs">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                <Input
                  value={buscaFuncionario}
                  onChange={(e) => setBuscaFuncionario(e.target.value)}
                  placeholder="Buscar por nome, cargo ou CPF..."
                  className="pl-9 h-9 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              <Select value={filtroStatusFunc} onValueChange={setFiltroStatusFunc}>
                <SelectTrigger className="w-36 h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="ferias">Férias</SelectItem>
                  <SelectItem value="afastado">Afastado</SelectItem>
                  <SelectItem value="demitido">Demitido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {canManage && (
              <Button
                onClick={() => handleOpenFuncModal()}
                className="gap-2 rounded-xl text-xs font-semibold h-9 bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                <Plus className="h-4 w-4" />
                <span>Nova Admissão</span>
              </Button>
            )}
          </div>

          {/* Tabela de Funcionários */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-3 px-4">Nome Completo / CPF</th>
                    <th className="py-3 px-4">Empresa</th>
                    <th className="py-3 px-4">Cargo / Tipo</th>
                    <th className="py-3 px-4">Conformidade e-Social</th>
                    <th className="py-3 px-4">Admissão</th>
                    <th className="py-3 px-4">Salário Base</th>
                    <th className="py-3 px-4">Status</th>
                    {canManage && <th className="py-3 px-4 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                        Carregando quadro de colaboradores...
                      </td>
                    </tr>
                  ) : funcionarios.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                        Nenhum funcionário encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    funcionarios.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              setFichaColaboradorId(f.id)
                              setFichaColaboradorOpen(true)
                            }}
                            className="font-bold text-[#1A2333] hover:text-[#0FA3A3] hover:underline cursor-pointer text-left block"
                          >
                            {f.nome_completo}
                          </button>
                          <p className="text-[11px] text-[#64748B]">CPF: {maskCpf(f.cpf)}</p>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-[#475569]">
                          {f.expand?.empresa?.nome_fantasia ||
                            f.expand?.empresa?.razao_social ||
                            '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-[#1A2333]">{f.cargo}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#64748B]">
                              {f.tipo}
                            </span>
                            {f.cbo && (
                              <span className="inline-block rounded-md bg-sky-50 text-sky-700 px-1.5 py-0.5 text-[10px] font-mono">
                                CBO: {f.cbo}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {(() => {
                            const conf = esocialService.validarConformidadeFuncionario(f)
                            if (conf.statusConformidade === 'conforme') {
                              return (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold gap-1">
                                  <ShieldCheck className="h-3 w-3" />
                                  <span>100% Conforme</span>
                                </Badge>
                              )
                            }
                            if (conf.statusConformidade === 'pendencias') {
                              return (
                                <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[11px] font-semibold gap-1">
                                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                                  <span>
                                    {conf.percentual}% ({conf.pendencias.length} alertas)
                                  </span>
                                </Badge>
                              )
                            }
                            return (
                              <Badge className="bg-rose-50 text-rose-800 border-rose-200 text-[11px] font-semibold gap-1">
                                <AlertTriangle className="h-3 w-3 text-rose-600" />
                                <span>{conf.percentual}% (Crítico)</span>
                              </Badge>
                            )
                          })()}
                        </td>
                        <td className="py-3.5 px-4 text-[#64748B]">
                          {formatDatePtBr(f.data_admissao)}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-[#1A2333]">
                          R${' '}
                          {f.salario.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3.5 px-4">
                          {f.status === 'ativo' && (
                            <Badge className="bg-[#DCFCE7] text-[#16A34A] border-emerald-200">
                              Ativo
                            </Badge>
                          )}
                          {f.status === 'ferias' && (
                            <Badge className="bg-[#FEF3C7] text-[#D97706] border-amber-200">
                              Férias
                            </Badge>
                          )}
                          {f.status === 'afastado' && (
                            <Badge className="bg-[#F3E8FF] text-[#9333EA] border-purple-200">
                              Afastado
                            </Badge>
                          )}
                          {f.status === 'demitido' && (
                            <Badge className="bg-[#FEE2E2] text-[#DC2626] border-rose-200">
                              Demitido
                            </Badge>
                          )}
                        </td>
                        {canManage && (
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenFuncModal(f)}
                                className="h-7 w-7 p-0 text-[#64748B] hover:text-[#0FA3A3]"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteFuncionario(f.id, f.nome_completo)}
                                className="h-7 w-7 p-0 text-[#64748B] hover:text-[#EF4444]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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
        </TabsContent>

        {/* === TAB 2: FOLHA DE PAGAMENTO === */}
        <TabsContent value="folha" className="space-y-4 mt-4">
          {/* Header da Folha e Resumos */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-2xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#64748B]" />
                <Select value={selectedCompetencia} onValueChange={setSelectedCompetencia}>
                  <SelectTrigger className="w-36 h-9 text-xs rounded-xl border-[#E2E8F0]">
                    <SelectValue placeholder="Competência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="08/2026">08/2026</SelectItem>
                    <SelectItem value="09/2026">09/2026</SelectItem>
                    <SelectItem value="10/2026">10/2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {canManage && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleProcessarFolha}
                  disabled={processingFolha}
                  className="gap-2 rounded-xl text-xs font-semibold h-9 bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
                >
                  <PlayCircle className="h-4 w-4" />
                  <span>
                    {processingFolha ? 'Calculando...' : 'Processar Folha da Competência'}
                  </span>
                </Button>
                {folhaRecords.length > 0 && (
                  <Button
                    onClick={handlePagarLote}
                    variant="outline"
                    className="gap-2 rounded-xl text-xs font-semibold h-9 border-[#E2E8F0]"
                  >
                    <CheckCheck className="h-4 w-4 text-emerald-600" />
                    <span>Quitar Folha</span>
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Cards Totalizadores de Folha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Salário Bruto Total
                  </p>
                  <p className="text-xl font-bold text-[#1A2333] mt-1">
                    R${' '}
                    {folhaTotais.bruto.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-[#2563EB]">
                  <DollarSign className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    INSS & IRRF Retidos
                  </p>
                  <p className="text-xl font-bold text-[#D97706] mt-1">
                    R${' '}
                    {(folhaTotais.inss + folhaTotais.irrf).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-[#D97706]">
                  <Receipt className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    FGTS Patronal (8%)
                  </p>
                  <p className="text-xl font-bold text-[#6366F1] mt-1">
                    R${' '}
                    {folhaTotais.fgts.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-[#6366F1]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Líquido a Pagar
                  </p>
                  <p className="text-xl font-bold text-[#16A34A] mt-1">
                    R${' '}
                    {folhaTotais.liquido.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-[#16A34A]">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Holerites da Competência */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Salário Base</th>
                    <th className="py-3 px-4">Bruto Apurado</th>
                    <th className="py-3 px-4">INSS</th>
                    <th className="py-3 px-4">IRRF</th>
                    <th className="py-3 px-4">FGTS (8%)</th>
                    <th className="py-3 px-4">Total Líquido</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Detalhamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                  {folhaRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-[#94A3B8]">
                        Nenhuma folha gerada para a competência {selectedCompetencia}. Clique em
                        &quot;Processar Folha da Competência&quot; acima.
                      </td>
                    </tr>
                  ) : (
                    folhaRecords.map((item) => {
                      const isExpanded = expandedFolhaId === item.id
                      let provArr: {
                        descricao: string
                        valor: number
                        codigo?: string
                        rubrica_esocial?: string
                        referencia?: string
                      }[] = []
                      let descArr: {
                        descricao: string
                        valor: number
                        codigo?: string
                        rubrica_esocial?: string
                        referencia?: string
                      }[] = []

                      if (item.proventos) {
                        try {
                          provArr =
                            typeof item.proventos === 'string'
                              ? JSON.parse(item.proventos)
                              : item.proventos
                        } catch {
                          /* intentionally ignored */
                        }
                      }
                      if (item.descontos) {
                        try {
                          descArr =
                            typeof item.descontos === 'string'
                              ? JSON.parse(item.descontos)
                              : item.descontos
                        } catch {
                          /* intentionally ignored */
                        }
                      }

                      const totalBrutoItem =
                        provArr.reduce((acc, c) => acc + (c.valor || 0), 0) || item.salario_base

                      return (
                        <React.Fragment key={item.id}>
                          <tr className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-[#1A2333]">
                              {item.funcionario ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFichaColaboradorId(item.funcionario)
                                    setFichaColaboradorOpen(true)
                                  }}
                                  className="font-bold text-[#1A2333] hover:text-[#0FA3A3] hover:underline cursor-pointer text-left block"
                                >
                                  {item.expand?.funcionario?.nome_completo || 'Colaborador'}
                                </button>
                              ) : (
                                <span>
                                  {item.expand?.funcionario?.nome_completo || 'Colaborador'}
                                </span>
                              )}
                              <p className="text-[11px] font-normal text-[#64748B]">
                                {item.expand?.funcionario?.cargo || 'Cargo'}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                              R$ {item.salario_base.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-[#1A2333]">
                              R$ {totalBrutoItem.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-amber-600">
                              - R$ {item.inss.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-amber-600">
                              - R$ {item.irrf.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-indigo-600">
                              R$ {item.fgts.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                              R$ {item.total_liquido.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4">
                              {item.status === 'paga' ? (
                                <Badge className="bg-[#DCFCE7] text-[#16A34A] border-emerald-200">
                                  Paga
                                </Badge>
                              ) : (
                                <Badge className="bg-[#FEF3C7] text-[#D97706] border-amber-200">
                                  Processada
                                </Badge>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setExpandedFolhaId(isExpanded ? null : item.id)}
                                  className="h-7 text-xs font-semibold gap-1 text-[#0FA3A3] hover:bg-teal-50"
                                >
                                  <span>{isExpanded ? 'Ocultar' : 'Ver Holerite'}</span>
                                  {isExpanded ? (
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                                {canManage && item.status !== 'paga' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleMarcarFolhaPaga(item.id)}
                                    className="h-7 text-[11px] font-semibold text-[#16A34A] border-emerald-200 hover:bg-emerald-50"
                                  >
                                    Quitar
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Linha expansível com o espelho detalhado do cálculo CLT */}
                          {isExpanded && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={9} className="p-4 border-b border-slate-200">
                                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                                  <div className="flex items-center justify-between border-b pb-2">
                                    <div>
                                      <h4 className="font-bold text-xs text-[#1A2333]">
                                        Demonstrativo de Pagamento CLT •{' '}
                                        {item.expand?.funcionario?.nome_completo}
                                      </h4>
                                      <p className="text-[11px] text-[#64748B]">
                                        Competência: {item.competencia} • Dependentes IRRF:{' '}
                                        {item.expand?.funcionario?.dependentes_irrf || 0}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge className="bg-teal-50 text-[#0FA3A3] border-teal-200 text-[10px]">
                                        CLT Progressivo Vigente
                                      </Badge>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Proventos */}
                                    <div className="space-y-1.5">
                                      <p className="font-bold text-xs text-emerald-700 uppercase tracking-wide">
                                        Proventos Remuneratórios (+)
                                      </p>
                                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-2 space-y-1">
                                        {provArr.map((p, idx) => (
                                          <div
                                            key={idx}
                                            className="flex items-center justify-between text-xs py-0.5"
                                          >
                                            <div>
                                              <span className="font-medium text-[#1A2333]">
                                                {p.descricao}
                                              </span>
                                              {p.referencia && (
                                                <span className="text-[10px] text-[#64748B] block">
                                                  Ref: {p.referencia}
                                                </span>
                                              )}
                                            </div>
                                            <span className="font-mono font-bold text-emerald-700">
                                              R$ {p.valor.toFixed(2)}
                                            </span>
                                          </div>
                                        ))}
                                        <div className="pt-1 border-t border-emerald-200 flex justify-between font-bold text-xs text-emerald-900">
                                          <span>Total Bruto:</span>
                                          <span>R$ {totalBrutoItem.toFixed(2)}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Descontos */}
                                    <div className="space-y-1.5">
                                      <p className="font-bold text-xs text-rose-700 uppercase tracking-wide">
                                        Descontos Legais & Variáveis (-)
                                      </p>
                                      <div className="rounded-lg border border-rose-100 bg-rose-50/30 p-2 space-y-1">
                                        {descArr.map((d, idx) => (
                                          <div
                                            key={idx}
                                            className="flex items-center justify-between text-xs py-0.5"
                                          >
                                            <div>
                                              <span className="font-medium text-[#1A2333]">
                                                {d.descricao}
                                              </span>
                                              {d.referencia && (
                                                <span className="text-[10px] text-[#64748B] block">
                                                  Ref: {d.referencia}
                                                </span>
                                              )}
                                            </div>
                                            <span className="font-mono font-bold text-rose-700">
                                              - R$ {d.valor.toFixed(2)}
                                            </span>
                                          </div>
                                        ))}
                                        <div className="pt-1 border-t border-rose-200 flex justify-between font-bold text-xs text-rose-900">
                                          <span>Total Descontos:</span>
                                          <span>
                                            - R${' '}
                                            {descArr
                                              .reduce((acc, c) => acc + (c.valor || 0), 0)
                                              .toFixed(2)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Resumo Líquido */}
                                  <div className="p-3 bg-slate-50 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs border border-slate-200">
                                    <div className="flex items-center gap-4">
                                      <div>
                                        <span className="text-[#64748B] text-[11px] block">
                                          Base INSS:
                                        </span>
                                        <span className="font-mono font-bold text-[#1A2333]">
                                          R$ {totalBrutoItem.toFixed(2)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-[#64748B] text-[11px] block">
                                          Depósito FGTS 8%:
                                        </span>
                                        <span className="font-mono font-bold text-indigo-700">
                                          R$ {item.fgts.toFixed(2)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[#64748B] text-[11px] block">
                                        Líquido a Receber:
                                      </span>
                                      <span className="text-lg font-mono font-bold text-emerald-700">
                                        R$ {item.total_liquido.toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* === TAB 3: VERBAS & DESCONTOS (CLT) === */}
        <TabsContent value="verbas" className="space-y-4 mt-4">
          <PainelVerbas
            tenantId={tenant?.id || ''}
            usuarioId={member?.user_id || ''}
            perfilUsuario={member?.perfil}
            empresas={empresas}
            selectedEmpresaId={selectedEmpresaId}
            onEmpresaChange={setSelectedEmpresaId}
            selectedCompetencia={selectedCompetencia}
            onSelectCompetencia={setSelectedCompetencia}
            onFolhaRecalculated={() => loadData()}
            onAbrirFichaColaborador={(id) => {
              setFichaColaboradorId(id)
              setFichaColaboradorOpen(true)
            }}
          />
        </TabsContent>

        {/* === TAB: BENEFÍCIOS (VT / VA / VR) === */}
        <TabsContent value="beneficios" className="space-y-4 mt-4">
          <PainelBeneficios
            empresaSelecionadaId={selectedEmpresaId}
            empresas={empresas}
            competenciaAtual={selectedCompetencia}
            funcionarios={funcionarios}
            beneficios={beneficios}
            loading={loading}
            onRefresh={loadData}
            onAbrirFichaColaborador={(id) => {
              setFichaColaboradorId(id)
              setFichaColaboradorOpen(true)
            }}
          />
        </TabsContent>

        {/* === TAB: CONVENÇÕES COLETIVAS (MONITORAMENTO & 1 CLIQUE) === */}
        <TabsContent value="convencoes" className="space-y-4 mt-4">
          <PainelConvencoes
            empresaSelecionadaId={selectedEmpresaId}
            empresas={empresas}
            competenciaAtual={selectedCompetencia}
            funcionarios={funcionarios}
            convencoes={convencoes}
            historicosSalariais={historicosSalariais}
            loading={loading}
            onRefresh={loadData}
          />
        </TabsContent>

        {/* === TAB: FÉRIAS & 13º SALÁRIO (CLT) === */}
        <TabsContent value="ferias_decimo" className="space-y-4 mt-4">
          <PainelFeriasDecimo
            tenantId={tenant?.id || ''}
            usuarioId={member?.user_id || ''}
            perfilUsuario={member?.perfil || ''}
            empresas={empresas}
            selectedEmpresaId={selectedEmpresaId}
            onEmpresaChange={setSelectedEmpresaId}
            onAbrirFichaColaborador={(id) => {
              setFichaColaboradorId(id)
              setFichaColaboradorOpen(true)
            }}
          />
        </TabsContent>

        {/* === TAB: RESCISÕES & TRCT (CLT) === */}
        <TabsContent value="rescisoes" className="space-y-4 mt-4">
          <PainelRescisoes
            tenantId={tenant?.id || ''}
            usuarioId={member?.user_id || ''}
            perfilUsuario={member?.perfil || ''}
            empresas={empresas}
            selectedEmpresaId={selectedEmpresaId}
            onEmpresaChange={setSelectedEmpresaId}
            onNavegarEsocial={() => setActiveTab('esocial')}
            onAbrirFichaColaborador={(id) => {
              setFichaColaboradorId(id)
              setFichaColaboradorOpen(true)
            }}
          />
        </TabsContent>
        {/* === TAB 3: EVENTUAIS / EVENTOS DP === */}
        <TabsContent value="eventuais" className="space-y-4 mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-3 rounded-2xl border border-[#E2E8F0] shadow-2xs">
            <div className="flex items-center gap-3">
              <Select value={filtroTipoEvento} onValueChange={setFiltroTipoEvento}>
                <SelectTrigger className="w-48 h-9 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Tipo de Ocorrência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  <SelectItem value="admissao">Admissão</SelectItem>
                  <SelectItem value="demissao">Demissão</SelectItem>
                  <SelectItem value="ferias">Férias</SelectItem>
                  <SelectItem value="afastado">Afastamento</SelectItem>
                  <SelectItem value="alteracao_salarial">Alteração Salarial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {canManage && (
              <Button
                onClick={handleOpenEventoModal}
                className="gap-2 rounded-xl text-xs font-semibold h-9 bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                <Plus className="h-4 w-4" />
                <span>Registrar Eventual</span>
              </Button>
            )}
          </div>

          {/* Timeline de Eventos */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xs">
            {eventos.length === 0 ? (
              <p className="text-center py-8 text-xs text-[#94A3B8]">
                Nenhum evento eventual de DP registrado.
              </p>
            ) : (
              <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
                {eventos.map((ev) => (
                  <div key={ev.id} className="relative pl-6">
                    <span
                      className={cn(
                        'absolute -left-2.5 top-1 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white',
                        ev.tipo === 'admissao' && 'bg-[#16A34A]',
                        ev.tipo === 'demissao' && 'bg-[#DC2626]',
                        ev.tipo === 'ferias' && 'bg-[#D97706]',
                        ev.tipo === 'afastado' && 'bg-[#9333EA]',
                        ev.tipo === 'alteracao_salarial' && 'bg-[#2563EB]',
                      )}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#1A2333] capitalize">
                          {ev.tipo.replace('_', ' ')}:{' '}
                          {ev.expand?.funcionario?.nome_completo || 'Colaborador'}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {ev.expand?.empresa?.nome_fantasia || 'Empresa'}
                        </Badge>
                      </div>
                      <span className="text-xs text-[#64748B] flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDatePtBr(ev.data_evento)}
                      </span>
                    </div>
                    <p className="text-xs text-[#475569] mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {ev.descricao}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* === TAB 4: e-SOCIAL (S-1.1 CONFORMIDADE) === */}
        <TabsContent value="esocial" className="space-y-4 mt-4">
          <PainelEsocial
            tenantId={tenant?.id || ''}
            userId={member?.user_id || ''}
            userRole={member?.perfil}
            empresas={empresas}
            selectedEmpresaId={selectedEmpresaId}
            onSelectEmpresaId={setSelectedEmpresaId}
            selectedCompetencia={selectedCompetencia}
            onSelectCompetencia={setSelectedCompetencia}
            onAbrirFichaColaborador={(id) => {
              setFichaColaboradorId(id)
              setFichaColaboradorOpen(true)
            }}
          />
        </TabsContent>

        {/* === TAB 5: EFD-REINF & DCTFWEB (INTEGRAÇÃO FEDERAL) === */}
        <TabsContent value="reinf_dctfweb" className="space-y-4 mt-4">
          <PainelReinfDctfweb
            empresas={empresas}
            selectedEmpresaId={selectedEmpresaId}
            selectedCompetencia={selectedCompetencia}
            canManage={canManage}
            canEdit={member?.perfil === 'administrador' || member?.perfil === 'contador'}
            onNavigateToEsocial={() => setActiveTab('esocial')}
          />
        </TabsContent>
      </Tabs>

      {/* Modal: Admissão / Editar Funcionário */}
      <Dialog open={modalFuncOpen} onOpenChange={setModalFuncOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingFuncionario ? 'Editar Colaborador' : 'Nova Admissão de Colaborador'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preencha os dados do contrato de trabalho e remuneração base.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveFuncionario} className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Empresa Contratante</Label>
              <Select value={formFuncEmpresa} onValueChange={setFormFuncEmpresa} required>
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
              <Label className="text-xs font-semibold">Nome Completo</Label>
              <Input
                value={formFuncNome}
                onChange={(e) => setFormFuncNome(e.target.value)}
                placeholder="Ex: Carlos Eduardo Silveira"
                required
                className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">CPF (com validação)</Label>
                <Input
                  value={formFuncCpf}
                  onChange={(e) => setFormFuncCpf(maskCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  required
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Cargo</Label>
                <Input
                  value={formFuncCargo}
                  onChange={(e) => setFormFuncCargo(e.target.value)}
                  placeholder="Ex: Desenvolvedor Pleno"
                  required
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Data Admissão</Label>
                <Input
                  type="date"
                  value={formFuncAdmissao}
                  onChange={(e) => setFormFuncAdmissao(e.target.value)}
                  required
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Salário Base (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formFuncSalario}
                  onChange={(e) => setFormFuncSalario(e.target.value)}
                  placeholder="Ex: 4500.00"
                  required
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Tipo Contrato</Label>
                <Select
                  value={formFuncTipo}
                  onValueChange={(v) => setFormFuncTipo(v as FuncionarioTipo)}
                >
                  <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clt">CLT Integral</SelectItem>
                    <SelectItem value="pj">Prestador PJ</SelectItem>
                    <SelectItem value="estagio">Estágio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Status Inicial</Label>
                <Select
                  value={formFuncStatus}
                  onValueChange={(v) => setFormFuncStatus(v as FuncionarioStatus)}
                >
                  <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="ferias">Férias</SelectItem>
                    <SelectItem value="afastado">Afastado</SelectItem>
                    <SelectItem value="demitido">Demitido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Centro de Custo / Setor (Opcional)</Label>
              <Input
                value={formFuncCentroCusto}
                onChange={(e) => setFormFuncCentroCusto(e.target.value)}
                placeholder="Ex: Operacional / Administrativo"
                className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
              />
            </div>

            {/* SEÇÃO CONFORMIDADE E-SOCIAL */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#0FA3A3]" />
                <span className="font-bold text-xs text-[#1A2333]">
                  Campos e-Social (Layout S-1.1)
                </span>
                <Badge variant="outline" className="text-[10px] text-[#0FA3A3] border-[#0FA3A3]/30">
                  Obrigatório para S-2200
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">PIS / NIS / PASEP (11 dígitos)</Label>
                  <Input
                    value={formFuncNisPis}
                    onChange={(e) => setFormFuncNisPis(e.target.value)}
                    placeholder="000.00000.00-0"
                    className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">CBO Oficial (MTE)</Label>
                  <Input
                    value={formFuncCbo}
                    onChange={(e) => setFormFuncCbo(e.target.value)}
                    placeholder="Ex: 2124-05"
                    className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs font-semibold">CTPS Nº</Label>
                  <Input
                    value={formFuncCtpsNum}
                    onChange={(e) => setFormFuncCtpsNum(e.target.value)}
                    placeholder="0459821"
                    className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Série</Label>
                  <Input
                    value={formFuncCtpsSerie}
                    onChange={(e) => setFormFuncCtpsSerie(e.target.value)}
                    placeholder="0040"
                    className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">UF</Label>
                  <Input
                    value={formFuncCtpsUf}
                    onChange={(e) => setFormFuncCtpsUf(e.target.value)}
                    placeholder="SP"
                    maxLength={2}
                    className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Grau de Instrução</Label>
                  <Select value={formFuncGrauInstr} onValueChange={setFormFuncGrauInstr}>
                    <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fundamental_incompleto">Fundamental Incompleto</SelectItem>
                      <SelectItem value="fundamental_completo">Fundamental Completo</SelectItem>
                      <SelectItem value="medio_incompleto">Médio Incompleto</SelectItem>
                      <SelectItem value="medio_completo">Médio Completo</SelectItem>
                      <SelectItem value="superior_incompleto">Superior Incompleto</SelectItem>
                      <SelectItem value="superior_completo">Superior Completo</SelectItem>
                      <SelectItem value="pos_graduacao">Pós-Graduação / Especialização</SelectItem>
                      <SelectItem value="mestrado">Mestrado</SelectItem>
                      <SelectItem value="doutorado">Doutorado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Raça / Cor</Label>
                  <Select value={formFuncRacaCor} onValueChange={setFormFuncRacaCor}>
                    <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="branca">Branca</SelectItem>
                      <SelectItem value="preta">Preta</SelectItem>
                      <SelectItem value="parda">Parda</SelectItem>
                      <SelectItem value="amarela">Amarela</SelectItem>
                      <SelectItem value="indigena">Indígena</SelectItem>
                      <SelectItem value="nao_informado">Não informado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Nome da Mãe (Filiação)</Label>
                  <Input
                    value={formFuncNomeMae}
                    onChange={(e) => setFormFuncNomeMae(e.target.value)}
                    placeholder="Nome completo da genitora"
                    className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Dependentes IRRF (Qtd)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formFuncDepIrrf}
                    onChange={(e) => setFormFuncDepIrrf(e.target.value)}
                    placeholder="0"
                    className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Sexo Biológico</Label>
                  <Select
                    value={formFuncSexo}
                    onValueChange={(v) => setFormFuncSexo(v as 'M' | 'F')}
                  >
                    <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Matrícula e-Social (Única)</Label>
                  <Input
                    value={formFuncMatricula}
                    onChange={(e) => setFormFuncMatricula(e.target.value)}
                    placeholder="Ex: EMP-001"
                    className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalFuncOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingFunc}
                className="rounded-xl text-xs bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                {savingFunc ? 'Salvando...' : 'Confirmar Admissão'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Ficha E-Social do Colaborador (Visão 360º & Timeline Completa) */}
      <FichaColaboradorModal
        funcionarioId={fichaColaboradorId}
        tenantId={tenant?.id || ''}
        userRole={member?.perfil}
        open={fichaColaboradorOpen}
        onOpenChange={setFichaColaboradorOpen}
        onEditarColaborador={(func) => {
          handleOpenFuncModal(func)
        }}
        onNavegarAba={(aba) => {
          setActiveTab(aba)
        }}
      />

      {/* Modal: Registrar Evento Eventual */}
      <Dialog open={modalEventoOpen} onOpenChange={setModalEventoOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Registrar Ocorrência / Eventual DP</DialogTitle>
            <DialogDescription className="text-xs">
              Registre férias, demissão, afastamento ou alteração na timeline do colaborador.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEvento} className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Empresa</Label>
              <Select value={formEventoEmpresa} onValueChange={setFormEventoEmpresa} required>
                <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                  <SelectValue />
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
              <Label className="text-xs font-semibold">Colaborador</Label>
              <Select value={formEventoFunc} onValueChange={setFormEventoFunc} required>
                <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                  <SelectValue placeholder="Selecione o colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {funcionarios
                    .filter((f) => !formEventoEmpresa || f.empresa === formEventoEmpresa)
                    .map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome_completo} ({f.cargo})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Tipo de Evento</Label>
                <Select
                  value={formEventoTipo}
                  onValueChange={(v) => setFormEventoTipo(v as EventoDpTipo)}
                >
                  <SelectTrigger className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ferias">Férias</SelectItem>
                    <SelectItem value="demissao">Demissão / Rescisão</SelectItem>
                    <SelectItem value="afastado">Afastamento Médico / INSS</SelectItem>
                    <SelectItem value="alteracao_salarial">Alteração Salarial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Data do Evento</Label>
                <Input
                  type="date"
                  value={formEventoData}
                  onChange={(e) => setFormEventoData(e.target.value)}
                  required
                  className="h-9 rounded-xl border-[#E2E8F0] mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Descrição / Detalhes</Label>
              <Textarea
                value={formEventoDesc}
                onChange={(e) => setFormEventoDesc(e.target.value)}
                placeholder="Ex: Período aquisitivo 2024/2025, gozo de 30 dias de férias..."
                required
                className="rounded-xl border-[#E2E8F0] text-xs resize-none h-20 mt-1"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalEventoOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingEvento}
                className="rounded-xl text-xs bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                {savingEvento ? 'Gravando...' : 'Salvar Evento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

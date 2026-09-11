import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Receipt,
  Building2,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCw,
  DollarSign,
  ArrowRight,
  PlusCircle,
  FileText,
  CreditCard,
  CheckCheck,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { impostosRetidosService } from '@/services/impostosRetidos'
import { financeiroService } from '@/services/financeiro'
import pb from '@/lib/pocketbase/client'
import type {
  Empresa,
  ImpostoRetidoRecord,
  ImpostoRetidoTipo,
  ImpostoRetidoStatus,
  ContaBancariaRecord,
  FolhaPagamento,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/hooks/use-toast'
import { formatDatePtBr } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export function ImpostosRetidosPage() {
  const { tenant, user, member } = useAuth()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [contasBancarias, setContasBancarias] = useState<ContaBancariaRecord[]>([])
  const [impostos, setImpostos] = useState<ImpostoRetidoRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('todas')
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>('todas')
  const [selectedTipo, setSelectedTipo] = useState<ImpostoRetidoTipo | 'todos'>('todos')
  const [selectedStatus, setSelectedStatus] = useState<ImpostoRetidoStatus | 'todos'>('todos')
  const [searchTerm, setSearchTerm] = useState('')

  // Seleção múltipla para pagamento em lote
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Modais
  const [pagarModalOpen, setPagarModalOpen] = useState(false)
  const [impostoToPay, setImpostoToPay] = useState<ImpostoRetidoRecord | null>(null)
  const [isLotePayment, setIsLotePayment] = useState(false)
  const [selectedContaBancariaId, setSelectedContaBancariaId] = useState<string>('')
  const [paying, setPaying] = useState(false)

  // Modal para apuração / regeneração manual de competência
  const [gerarModalOpen, setGerarModalOpen] = useState(false)
  const [gerarEmpresaId, setGerarEmpresaId] = useState('')
  const [gerarCompetencia, setGerarCompetencia] = useState('09/2026')
  const [gerando, setGerando] = useState(false)

  const isContadorOrAdmin = member?.perfil === 'contador' || member?.perfil === 'administrador'

  // Carregar dados iniciais
  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const [emps, bancos, listaImpostos] = await Promise.all([
        empresasService.list(tenant.id),
        financeiroService.listContasBancarias(tenant.id).catch(() => []),
        impostosRetidosService.list(tenant.id, {
          empresaId: selectedEmpresaId,
          competencia: selectedCompetencia,
          tipo: selectedTipo,
          status: selectedStatus,
        }),
      ])

      setEmpresas(emps)
      setContasBancarias(bancos)
      setImpostos(listaImpostos)
      if (bancos.length > 0 && !selectedContaBancariaId) {
        setSelectedContaBancariaId(bancos[0].id)
      }
      if (emps.length > 0 && !gerarEmpresaId) {
        setGerarEmpresaId(emps[0].id)
      }
    } catch (err) {
      console.error('Erro ao carregar impostos retidos:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar a lista de impostos retidos.',
      })
    } finally {
      setLoading(false)
    }
  }, [
    tenant?.id,
    selectedEmpresaId,
    selectedCompetencia,
    selectedTipo,
    selectedStatus,
    selectedContaBancariaId,
    gerarEmpresaId,
  ])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filtragem no cliente para busca textual
  const filteredImpostos = useMemo(() => {
    return impostos.filter((imp) => {
      if (!searchTerm) return true
      const term = searchTerm.toLowerCase()
      const empresaNome =
        imp.expand?.empresa?.nome_fantasia?.toLowerCase() ||
        imp.expand?.empresa?.razao_social?.toLowerCase() ||
        ''
      const tipoNome = imp.tipo.toLowerCase()
      const comp = imp.competencia.toLowerCase()
      return empresaNome.includes(term) || tipoNome.includes(term) || comp.includes(term)
    })
  }, [impostos, searchTerm])

  // Cards totalizadores
  const totals = useMemo(() => {
    const totalGeral = filteredImpostos.reduce((acc, cur) => acc + (cur.valor || 0), 0)
    const totalPago = filteredImpostos
      .filter((i) => i.status === 'pago')
      .reduce((acc, cur) => acc + (cur.valor || 0), 0)
    const totalPendente = filteredImpostos
      .filter((i) => i.status === 'pendente')
      .reduce((acc, cur) => acc + (cur.valor || 0), 0)
    const totalAtrasado = filteredImpostos
      .filter((i) => i.status === 'atrasado')
      .reduce((acc, cur) => acc + (cur.valor || 0), 0)

    return {
      totalGeral,
      totalPago,
      totalPendente,
      totalAtrasado,
      qtdPendentes: filteredImpostos.filter((i) => i.status === 'pendente').length,
      qtdAtrasados: filteredImpostos.filter((i) => i.status === 'atrasado').length,
    }
  }, [filteredImpostos])

  // Competências disponíveis
  const competenciasDisponiveis = useMemo(() => {
    const set = new Set<string>()
    set.add('09/2026')
    set.add('08/2026')
    set.add('07/2026')
    impostos.forEach((i) => {
      if (i.competencia) set.add(i.competencia)
    })
    return Array.from(set).sort().reverse()
  }, [impostos])

  // Lógica de seleção em lote
  const handleToggleSelectAll = () => {
    const pendentes = filteredImpostos.filter((i) => i.status !== 'pago').map((i) => i.id)
    if (selectedIds.length === pendentes.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(pendentes)
    }
  }

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  // Abertura de pagamento individual
  const handleOpenPagarIndividual = (imp: ImpostoRetidoRecord) => {
    setImpostoToPay(imp)
    setIsLotePayment(false)
    setPagarModalOpen(true)
  }

  // Abertura de pagamento em lote
  const handleOpenPagarLote = () => {
    if (selectedIds.length === 0) return
    setIsLotePayment(true)
    setImpostoToPay(null)
    setPagarModalOpen(true)
  }

  // Executar liquidação
  const handleConfirmarPagamento = async () => {
    if (!tenant?.id) return
    setPaying(true)
    try {
      if (isLotePayment) {
        const pagos = await impostosRetidosService.pagarLote(
          selectedIds,
          selectedContaBancariaId || undefined,
          user?.id,
        )
        toast({
          title: 'Pagamento em lote concluído!',
          description: `${pagos} guia(s) liquidada(s), títulos atualizados no Financeiro e lançamentos contábeis gerados.`,
        })
        setSelectedIds([])
      } else if (impostoToPay) {
        await impostosRetidosService.pagarImpostoRetido(
          impostoToPay.id,
          selectedContaBancariaId || undefined,
          user?.id,
        )
        toast({
          title: 'Guia quitada com sucesso!',
          description: `Guia ${impostoToPay.tipo.toUpperCase()} marcada como paga. Partida dobrada contábil gerada.`,
        })
      }
      setPagarModalOpen(false)
      loadData()
    } catch (err) {
      console.error('Erro ao pagar imposto retido:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao liquidar guia',
        description: 'Verifique se a competência contábil não está fechada.',
      })
    } finally {
      setPaying(false)
    }
  }

  // Regeneração manual de impostos a partir da folha
  const handleGerarManual = async () => {
    if (!tenant?.id || !gerarEmpresaId || !gerarCompetencia) return
    setGerando(true)
    try {
      // Buscar folhas existentes da empresa e competência
      const folhas = await pb.collection('folha_pagamento').getFullList<FolhaPagamento>({
        filter: `tenant_id = "${tenant.id}" && empresa = "${gerarEmpresaId}" && competencia = "${gerarCompetencia}"`,
      })

      if (folhas.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nenhuma folha encontrada',
          description: `Não há registros de folha de pagamento para esta empresa na competência ${gerarCompetencia}. Calcule a folha no módulo DP primeiro.`,
        })
        return
      }

      const inssTotal = folhas.reduce((acc, cur) => acc + (cur.inss || 0), 0)
      const irrfTotal = folhas.reduce((acc, cur) => acc + (cur.irrf || 0), 0)
      const fgtsTotal = folhas.reduce((acc, cur) => acc + (cur.fgts || 0), 0)

      const result = await impostosRetidosService.gerarOuAtualizarImpostosFolha({
        tenantId: tenant.id,
        empresaId: gerarEmpresaId,
        competencia: gerarCompetencia,
        inssTotal,
        irrfTotal,
        fgtsTotal,
        folhaIdRef: `folha-${gerarCompetencia}`,
      })

      toast({
        title: 'Apuração concluída!',
        description: `${result.gerados} guia(s) criada(s) e ${result.atualizados} atualizada(s) no Financeiro e Fiscal.`,
      })
      setGerarModalOpen(false)
      loadData()
    } catch (err) {
      console.error('Erro na geração manual de impostos retidos:', err)
      toast({
        variant: 'destructive',
        title: 'Falha na geração',
        description: 'Não foi possível gerar os impostos retidos.',
      })
    } finally {
      setGerando(false)
    }
  }

  const getTipoLabel = (tipo: ImpostoRetidoTipo) => {
    switch (tipo) {
      case 'darf_inss':
        return 'DARF Previdenciário (INSS)'
      case 'darf_irrf':
        return 'DARF IRRF Folha'
      case 'fgts':
        return 'Guia FGTS Digital'
      default:
        return tipo
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1A2333]">
            Gestão de Impostos Retidos
          </h1>
          <p className="text-sm text-[#64748B]">
            Apuração automática de DARF (INSS/IRRF) e FGTS integrando Departamento Pessoal,
            Financeiro e Contabilidade
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isContadorOrAdmin && (
            <Button
              onClick={() => setGerarModalOpen(true)}
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl text-xs font-semibold h-10 border-[#E2E8F0] shadow-xs hover:bg-slate-50"
            >
              <RotateCw className="h-4 w-4 text-[#0FA3A3]" />
              <span>Apurar / Regenerar da Folha</span>
            </Button>
          )}

          {selectedIds.length > 0 && isContadorOrAdmin && (
            <Button
              onClick={handleOpenPagarLote}
              size="sm"
              className="gap-2 rounded-xl text-xs font-semibold h-10 bg-[#16A34A] hover:bg-[#15803D] text-white shadow-xs"
            >
              <CheckCheck className="h-4 w-4" />
              <span>Pagar Selecionados ({selectedIds.length})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Cards Totalizadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-[#64748B]">Total Apurado</span>
              <p className="text-xl font-extrabold text-[#1A2333]">
                R$ {totals.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-[#94A3B8]">
                {filteredImpostos.length} guia(s) no filtro
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <Receipt className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-[#64748B]">Total Pago / Liquidado</span>
              <p className="text-xl font-extrabold text-emerald-600">
                R$ {totals.totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-emerald-700/80">Com lançamento contábil</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-[#64748B]">A Pagar (No Prazo)</span>
              <p className="text-xl font-extrabold text-blue-600">
                R$ {totals.totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-blue-700/80">
                {totals.qtdPendentes} guia(s) pendente(s)
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-[#64748B]">Guias Atrasadas</span>
              <p className="text-xl font-extrabold text-rose-600">
                R$ {totals.totalAtrasado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-rose-700/80">
                {totals.qtdAtrasados} guia(s) vencida(s)
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
              <Input
                placeholder="Buscar por empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs rounded-xl h-9"
              />
            </div>

            {/* Empresa */}
            <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
              <SelectTrigger className="text-xs rounded-xl h-9">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Empresas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome_fantasia || e.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Competência */}
            <Select value={selectedCompetencia} onValueChange={setSelectedCompetencia}>
              <SelectTrigger className="text-xs rounded-xl h-9">
                <SelectValue placeholder="Competência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Competências</SelectItem>
                {competenciasDisponiveis.map((c) => (
                  <SelectItem key={c} value={c}>
                    Comp. {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tipo */}
            <Select
              value={selectedTipo}
              onValueChange={(val) => setSelectedTipo(val as ImpostoRetidoTipo | 'todos')}
            >
              <SelectTrigger className="text-xs rounded-xl h-9">
                <SelectValue placeholder="Tipo de Retenção" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="darf_inss">DARF INSS (Colaboradores)</SelectItem>
                <SelectItem value="darf_irrf">DARF IRRF</SelectItem>
                <SelectItem value="fgts">FGTS Digital</SelectItem>
              </SelectContent>
            </Select>

            {/* Status */}
            <Select
              value={selectedStatus}
              onValueChange={(val) => setSelectedStatus(val as ImpostoRetidoStatus | 'todos')}
            >
              <SelectTrigger className="text-xs rounded-xl h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Impostos Retidos */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-[#E2E8F0] py-4 px-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-[#1A2333]">
              Guias de Retenção e Encargos da Folha
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Vencimento padrão: DARF até dia 20 do mês seguinte • FGTS até dia 07 do mês seguinte
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748B]">
              Mostrando <strong className="text-[#1A2333]">{filteredImpostos.length}</strong>{' '}
              guia(s)
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">
                    <Checkbox
                      checked={
                        selectedIds.length > 0 &&
                        selectedIds.length ===
                          filteredImpostos.filter((i) => i.status !== 'pago').length
                      }
                      onCheckedChange={handleToggleSelectAll}
                    />
                  </th>
                  <th className="py-3 px-4">Tipo de Imposto</th>
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-4">Competência</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4 text-right">Valor Apurado</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Vínculo Financeiro / Contábil</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-[#94A3B8]">
                      Carregando guias de impostos retidos...
                    </td>
                  </tr>
                ) : filteredImpostos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-[#94A3B8]">
                      Nenhum imposto retido encontrado para os filtros selecionados.{' '}
                      {isContadorOrAdmin && (
                        <span className="block text-[11px] text-[#64748B] mt-1">
                          Você pode apurar competências passadas clicando em "Apurar / Regenerar da
                          Folha".
                        </span>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredImpostos.map((imp) => {
                    const isPago = imp.status === 'pago'
                    const isAtrasado = imp.status === 'atrasado'
                    const empresaNome =
                      imp.expand?.empresa?.nome_fantasia ||
                      imp.expand?.empresa?.razao_social ||
                      'Empresa'

                    return (
                      <tr key={imp.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <Checkbox
                            disabled={isPago}
                            checked={selectedIds.includes(imp.id)}
                            onCheckedChange={() => handleToggleSelectOne(imp.id)}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#1A2333]">{getTipoLabel(imp.tipo)}</div>
                          <span className="text-[10px] text-[#64748B]">
                            {imp.tipo === 'fgts' ? 'Caixa Econômica' : 'Receita Federal'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-[#334155]">{empresaNome}</td>
                        <td className="py-3 px-4 font-mono text-[#64748B]">{imp.competencia}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span>{formatDatePtBr(imp.vencimento)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#1A2333]">
                          R$ {imp.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4">
                          {isPago ? (
                            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold border-emerald-200">
                              Pago
                            </Badge>
                          ) : isAtrasado ? (
                            <Badge className="bg-rose-100 text-rose-800 text-[10px] font-bold border-rose-200">
                              Atrasado
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-800 text-[10px] font-bold border-blue-200">
                              Pendente
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-[#64748B]">
                          {imp.vinculo_titulo_financeiro ? (
                            <div className="flex items-center gap-1 text-slate-600">
                              <DollarSign className="h-3 w-3 text-emerald-600" />
                              <span>Título A Pagar Vinculado</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">Sem título</span>
                          )}
                          {imp.lote_contabil && (
                            <div className="font-mono text-[10px] text-teal-700">
                              Partida: {imp.lote_contabil}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!isPago && isContadorOrAdmin ? (
                            <Button
                              size="sm"
                              onClick={() => handleOpenPagarIndividual(imp)}
                              className="h-8 rounded-lg text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white shadow-xs"
                            >
                              Pagar Guia
                            </Button>
                          ) : isPago ? (
                            <span className="text-[11px] font-semibold text-emerald-700">
                              Liquidado ✓
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">Pendente</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Pagamento (Individual ou Lote) */}
      <Dialog open={pagarModalOpen} onOpenChange={setPagarModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#0FA3A3]" />
              <span>
                {isLotePayment
                  ? `Liquidar Lote (${selectedIds.length} guias)`
                  : `Liquidar Guia de Retenção`}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              A quitação atualiza o título no Financeiro e gera a partida dobrada contábil
              automática (Débito: Obrigações a Recolher / Crédito: Banco).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!isLotePayment && impostoToPay && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between font-bold text-[#1A2333]">
                  <span>{getTipoLabel(impostoToPay.tipo)}</span>
                  <span>
                    R$ {impostoToPay.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B] flex justify-between">
                  <span>Competência: {impostoToPay.competencia}</span>
                  <span>Vencimento: {formatDatePtBr(impostoToPay.vencimento)}</span>
                </div>
              </div>
            )}

            {isLotePayment && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <span className="text-slate-600 block">Total selecionado para quitação:</span>
                <span className="text-lg font-extrabold text-[#1A2333]">
                  R${' '}
                  {filteredImpostos
                    .filter((i) => selectedIds.includes(i.id))
                    .reduce((acc, cur) => acc + cur.valor, 0)
                    .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1A2333]">
                Conta Bancária de Liquidação *
              </label>
              <Select value={selectedContaBancariaId} onValueChange={setSelectedContaBancariaId}>
                <SelectTrigger className="text-xs rounded-xl h-10">
                  <SelectValue placeholder="Selecione a conta bancária" />
                </SelectTrigger>
                <SelectContent>
                  {contasBancarias.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nome} ({b.banco}) - Saldo: R${' '}
                      {b.saldo_atual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPagarModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarPagamento}
              disabled={paying}
              className="rounded-xl text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white shadow-xs"
            >
              {paying ? 'Processando Quitação...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Regeneração / Apuração Manual da Folha */}
      <Dialog open={gerarModalOpen} onOpenChange={setGerarModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
              <RotateCw className="h-5 w-5 text-[#0FA3A3]" />
              <span>Apurar Retenções da Folha de Pagamento</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Lê a folha calculada do DP e consolida DARF INSS, DARF IRRF e FGTS Digital com título
              financeiro gerado automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1A2333]">Empresa *</label>
              <Select value={gerarEmpresaId} onValueChange={setGerarEmpresaId}>
                <SelectTrigger className="text-xs rounded-xl h-10">
                  <SelectValue placeholder="Selecione a empresa" />
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

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1A2333]">Competência da Folha *</label>
              <Input
                value={gerarCompetencia}
                onChange={(e) => setGerarCompetencia(e.target.value)}
                placeholder="MM/AAAA (ex: 09/2026)"
                className="text-xs rounded-xl h-10 font-mono"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setGerarModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleGerarManual}
              disabled={gerando || !gerarEmpresaId || !gerarCompetencia}
              className="rounded-xl text-xs font-semibold bg-[#0FA3A3] hover:bg-[#0C8585] text-white shadow-xs"
            >
              {gerando ? 'Apurando Guias...' : 'Gerar / Atualizar Guias'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

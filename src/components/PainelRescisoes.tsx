import React, { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  UserX,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Printer,
  ShieldAlert,
  Info,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Send,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  type CreateRescisaoInput,
} from '@/services/calculosTrabalhistas'
import { calcularRescisaoClt } from '@/lib/calculoClt'
import type {
  Empresa,
  Funcionario,
  RescisaoRecord,
  RescisaoMotivo,
  AvisoPrevioTipo,
  ItemMapaMedia,
  ItemVerbaRescisoria,
  AlertaConformidadeClt,
} from '@/types'

interface PainelRescisoesProps {
  tenantId: string
  usuarioId: string
  perfilUsuario?: string
  empresas: Empresa[]
  selectedEmpresaId: string
  onEmpresaChange: (id: string) => void
  onNavegarEsocial?: () => void
  onAbrirFichaColaborador?: (funcionarioId: string) => void
}
export function PainelRescisoes({
  tenantId,
  usuarioId,
  perfilUsuario,
  empresas,
  selectedEmpresaId,
  onEmpresaChange,
  onNavegarEsocial,
  onAbrirFichaColaborador,
}: PainelRescisoesProps) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [rescisoesList, setRescisoesList] = useState<RescisaoRecord[]>([])

  // Modal de Nova Rescisão
  const [isNovaRescisaoOpen, setIsNovaRescisaoOpen] = useState(false)
  const [selectedRescisaoTrct, setSelectedRescisaoTrct] = useState<RescisaoRecord | null>(null)
  const [isTrctModalOpen, setIsTrctModalOpen] = useState(false)

  // Formulário de Rescisão
  const [formData, setFormData] = useState<{
    funcionarioId: string
    motivoDesligamento: RescisaoMotivo
    tipoAvisoPrevio: AvisoPrevioTipo
    dataAvisoPrevio: string
    dataDesligamento: string
    feriasVencidas: boolean
    saldoFgts: number
    descontoAdiantamento: number
    outrosProventos: number
    outrosDescontos: number
    observacoes: string
  }>({
    funcionarioId: '',
    motivoDesligamento: 'sem_justa_causa_empregador',
    tipoAvisoPrevio: 'indenizado',
    dataAvisoPrevio: new Date().toISOString().slice(0, 10),
    dataDesligamento: new Date().toISOString().slice(0, 10),
    feriasVencidas: false,
    saldoFgts: 12500,
    descontoAdiantamento: 0,
    outrosProventos: 0,
    outrosDescontos: 0,
    observacoes: '',
  })

  const [previewMedias, setPreviewMedias] = useState<{ media: number; itens: ItemMapaMedia[] }>({
    media: 0,
    itens: [],
  })

  // Carregar dados
  const carregarRescisoes = async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const list = await calculosTrabalhistasService.listRescisoes(tenantId, {
        empresaId: selectedEmpresaId,
      })
      setRescisoesList(list)
    } catch (e) {
      console.error(e)
      toast({
        title: 'Erro ao listar rescisões',
        description: 'Não foi possível carregar os desligamentos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Carregar lista de colaboradores ativos da empresa
  useEffect(() => {
    const fetchFuncs = async () => {
      try {
        const { dpService } = await import('@/services/dp')
        const all = await dpService.listFuncionarios(tenantId, {
          empresaId: selectedEmpresaId,
        })
        // Colaboradores CLT ativos para iniciar rescisão
        setFuncionarios(
          all.filter(
            (f) =>
              (f.tipo === 'clt' || (f as any).tipo_contrato === 'CLT') && f.status !== 'demitido',
          ),
        )
      } catch (err) {
        console.error(err)
      }
    }
    fetchFuncs()
    carregarRescisoes()
  }, [tenantId, selectedEmpresaId])

  // Colaborador selecionado no form
  const selectedFuncionario = useMemo(() => {
    return funcionarios.find((f) => f.id === formData.funcionarioId)
  }, [funcionarios, formData.funcionarioId])

  // Buscar médias ao trocar funcionário
  useEffect(() => {
    if (!formData.funcionarioId) return
    const f = funcionarios.find((x) => x.id === formData.funcionarioId)
    if (!f) return

    calculosTrabalhistasService
      .apurarMediasFuncionario(tenantId, f.empresa, f.id)
      .then((m) => setPreviewMedias(m))
      .catch(() => setPreviewMedias({ media: 0, itens: [] }))
  }, [formData.funcionarioId])

  // Simulação CLT em tempo real
  const simulacaoClt = useMemo(() => {
    if (!selectedFuncionario) return null
    return calcularRescisaoClt({
      salarioBase: selectedFuncionario.salario || 0,
      dataAdmissao: selectedFuncionario.data_admissao
        ? selectedFuncionario.data_admissao.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      dataDesligamento: formData.dataDesligamento,
      motivoDesligamento: formData.motivoDesligamento,
      tipoAvisoPrevio: formData.tipoAvisoPrevio,
      dataAvisoPrevio: formData.dataAvisoPrevio || undefined,
      mediaVariaveis: previewMedias.media,
      dependentes: selectedFuncionario.dependentes_irrf || 0,
      feriasVencidas: formData.feriasVencidas,
      saldoFgts: formData.saldoFgts,
      descontoAdiantamento: formData.descontoAdiantamento,
      outrosProventos: formData.outrosProventos,
      outrosDescontos: formData.outrosDescontos,
    })
  }, [selectedFuncionario, formData, previewMedias.media])

  // Gravar Simulação
  const handleGravarSimulacao = async () => {
    if (!selectedFuncionario) {
      toast({ title: 'Selecione um colaborador', variant: 'destructive' })
      return
    }

    try {
      setLoading(true)
      await calculosTrabalhistasService.criarRescisao(
        {
          tenant_id: tenantId,
          empresa: selectedFuncionario.empresa,
          funcionario: selectedFuncionario.id,
          motivo_desligamento: formData.motivoDesligamento,
          tipo_aviso_previo: formData.tipoAvisoPrevio,
          data_aviso_previo: formData.dataAvisoPrevio,
          data_desligamento: formData.dataDesligamento,
          ferias_vencidas: formData.feriasVencidas,
          saldo_fgts: formData.saldoFgts,
          desconto_adiantamento: formData.descontoAdiantamento,
          outros_proventos: formData.outrosProventos,
          outros_descontos: formData.outrosDescontos,
          observacoes: formData.observacoes,
        },
        usuarioId,
      )

      toast({
        title: 'Rescisão calculada com sucesso!',
        description: `Simulação registrada para ${selectedFuncionario.nome_completo}.`,
      })
      setIsNovaRescisaoOpen(false)
      carregarRescisoes()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao registrar rescisão',
        description: 'Revise os campos informados.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Homologar e Concluir Rescisão (desliga colaborador + gera S-2299)
  const handleHomologarRescisao = async (rec: RescisaoRecord) => {
    try {
      setLoading(true)
      await calculosTrabalhistasService.concluirRescisao(rec.id, usuarioId)
      toast({
        title: 'Rescisão Homologada com Sucesso!',
        description: `Colaborador desligado. Evento e-Social S-2299 enfileirado na aba e-Social e TRCT liberado.`,
      })
      carregarRescisoes()
    } catch (e) {
      console.error(e)
      toast({ title: 'Erro ao homologar rescisão', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner de Rescisões CLT */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/40 p-4 rounded-lg border border-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Rescisão de Contrato de Trabalho (CLT)
            </h2>
            <Badge
              variant="outline"
              className="border-emerald-500 bg-emerald-50 text-emerald-800 text-xs"
            >
              Conformidade S-2299 &amp; TRCT
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Cálculo de saldo de salário, aviso prévio (Lei 12.506/2011), férias
            proporcionais/vencidas, 13º com médias e multa rescisória de 40% do FGTS.
          </p>
        </div>

        <Button
          onClick={() => {
            if (funcionarios.length > 0) {
              setFormData((prev) => ({ ...prev, funcionarioId: funcionarios[0].id }))
            }
            setIsNovaRescisaoOpen(true)
          }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="w-4 h-4 mr-2" />
          Iniciar Nova Rescisão
        </Button>
      </div>

      {/* Lista de Rescisões */}
      {rescisoesList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <UserX className="w-12 h-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-base font-medium">Nenhum processo rescisório em aberto</h3>
            <p className="text-sm text-muted-foreground max-w-md mt-1">
              Inicie a rescisão de um colaborador CLT para simular verbas, checar alertas legais
              (art. 477) e gerar o Termo de Rescisão (TRCT).
            </p>
            <Button onClick={() => setIsNovaRescisaoOpen(true)} variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Simular Primeiro Desligamento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {rescisoesList.map((rec) => {
            const func = rec.expand?.funcionario
            const emp = rec.expand?.empresa
            const isConcluida = rec.status === 'concluida'
            const alertas = rec.alertas_conformidade_clt || []
            const temInfracao = alertas.some((a) => a.tipo === 'infracao')

            const prazoStr = rec.prazo_pagamento_limite
              ? new Date(rec.prazo_pagamento_limite).toLocaleDateString('pt-BR')
              : 'N/A'

            return (
              <Card key={rec.id} className="hover:border-primary/50 transition-colors">
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
                            isConcluida
                              ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                              : 'bg-amber-500/10 text-amber-700 border-amber-200'
                          }
                        >
                          {isConcluida ? 'Concluída & Transmitida' : 'Simulada / Pendente'}
                        </Badge>
                        {rec.saque_fgts_autorizado && (
                          <Badge
                            variant="secondary"
                            className="text-[11px] bg-blue-50 text-blue-700"
                          >
                            Saque FGTS Cód. {rec.codigo_saque_fgts}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Empresa: {emp?.razao_social || 'N/A'}</span>
                        <span>
                          Desligamento:{' '}
                          {new Date(rec.data_desligamento).toLocaleDateString('pt-BR')}
                        </span>
                        <span>Motivo: {formatMotivo(rec.motivo_desligamento)}</span>
                        <span>
                          Aviso: {rec.dias_aviso_previo} dias ({rec.tipo_aviso_previo})
                        </span>
                      </div>
                    </div>

                    {/* Totais e Ações */}
                    <div className="flex flex-wrap items-center gap-4 lg:gap-6">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Total Bruto Rescisão</div>
                        <div className="text-sm font-semibold text-foreground">
                          R${' '}
                          {rec.total_bruto_rescisao.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-[11px] text-rose-500">
                          - R${' '}
                          {rec.total_descontos_rescisao.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}{' '}
                          (Descontos)
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">
                          Multa FGTS ({rec.aliquota_multa_fgts}%)
                        </div>
                        <div className="text-sm font-semibold text-primary">
                          R${' '}
                          {rec.valor_multa_rescisoria_fgts?.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          }) || '0,00'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {rec.saque_fgts_autorizado
                            ? 'Chave Conectividade apta'
                            : 'Saque bloqueado'}
                        </div>
                      </div>

                      <div className="text-right pl-3 border-l border-border">
                        <div className="text-xs text-muted-foreground font-medium">
                          Líquido a Pagar
                        </div>
                        <div className="text-lg font-bold text-emerald-600">
                          R${' '}
                          {rec.total_liquido_rescisao.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Prazo Art. 477: {prazoStr}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRescisaoTrct(rec)
                            setIsTrctModalOpen(true)
                          }}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          Ver TRCT
                        </Button>

                        {!isConcluida && (
                          <Button
                            size="sm"
                            onClick={() => handleHomologarRescisao(rec)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Homologar & S-2299
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Alertas de Conformidade CLT */}
                  {alertas.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-dashed border-border/80 space-y-1">
                      {alertas.map((al, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-2 text-xs p-2 rounded-md ${
                            al.tipo === 'infracao'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="font-semibold">{al.regra}: </span>
                            <span>{al.mensagem}</span>
                            {al.sugestao && (
                              <p className="mt-0.5 text-[11px] opacity-90 italic">
                                Ação recomendada: {al.sugestao}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL 1: FORMULÁRIO COMPLETO DE RESCISÃO */}
      <Dialog open={isNovaRescisaoOpen} onOpenChange={setIsNovaRescisaoOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <UserX className="w-5 h-5 text-primary" />
              Simulação e Cálculo de Rescisão de Contrato CLT
            </DialogTitle>
            <DialogDescription>
              Cálculo completo conforme regras vigentes da CLT, Lei 12.506/2011 (aviso proporcional)
              e Lei 8.036/90 (FGTS e Multa de 40%).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Linha 1: Colaborador e Motivo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Colaborador CLT *</Label>
                <Select
                  value={formData.funcionarioId}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, funcionarioId: v }))}
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
                {selectedFuncionario && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Admissão:{' '}
                    {new Date(selectedFuncionario.data_admissao).toLocaleDateString('pt-BR')} • CPF:{' '}
                    {selectedFuncionario.cpf}
                  </p>
                )}
              </div>

              <div>
                <Label>Motivo de Desligamento (e-Social S-2299) *</Label>
                <Select
                  value={formData.motivoDesligamento}
                  onValueChange={(v: any) =>
                    setFormData((prev) => ({ ...prev, motivoDesligamento: v }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem_justa_causa_empregador">
                      Dispensa sem justa causa pelo empregador (Cód. 02 - Saque + 40% FGTS)
                    </SelectItem>
                    <SelectItem value="justa_causa_empregador">
                      Demissão com justa causa (Cód. 01 - Sem saque / Sem multa)
                    </SelectItem>
                    <SelectItem value="pedido_demissao">
                      Pedido de demissão pelo empregado (Cód. 07)
                    </SelectItem>
                    <SelectItem value="acordo_consensual_art_484_a">
                      Acordo Consensual CLT Art. 484-A (Cód. 33 - 50% aviso / 20% FGTS)
                    </SelectItem>
                    <SelectItem value="termino_contrato_experiencia">
                      Término de contrato de experiência (Cód. 04)
                    </SelectItem>
                    <SelectItem value="rescisao_indireta">
                      Rescisão indireta por falta grave do empregador (Cód. 03)
                    </SelectItem>
                    <SelectItem value="aposentadoria">
                      Aposentadoria voluntária (Cód. 09)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 2: Aviso Prévio e Datas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-muted/20 rounded-md border border-border">
              <div>
                <Label className="text-xs font-semibold">Tipo de Aviso Prévio</Label>
                <Select
                  value={formData.tipoAvisoPrevio}
                  onValueChange={(v: any) =>
                    setFormData((prev) => ({ ...prev, tipoAvisoPrevio: v }))
                  }
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indenizado">Indenizado pelo Empregador</SelectItem>
                    <SelectItem value="trabalhado">Trabalhado</SelectItem>
                    <SelectItem value="dispensado">Dispensado do Cumprimento</SelectItem>
                    <SelectItem value="nao_aplicavel">Não Aplicável</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Data Comunicação Aviso</Label>
                <Input
                  type="date"
                  className="mt-1 h-9"
                  value={formData.dataAvisoPrevio}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, dataAvisoPrevio: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Data Efetiva de Desligamento</Label>
                <Input
                  type="date"
                  className="mt-1 h-9"
                  value={formData.dataDesligamento}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, dataDesligamento: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Linha 3: FGTS e Ajustes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Saldo FGTS para Fins Rescisórios (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="mt-1 h-9"
                  value={formData.saldoFgts}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, saldoFgts: parseFloat(e.target.value) || 0 }))
                  }
                />
                <span className="text-[10px] text-muted-foreground">
                  Base informada para incidência da multa de 40% (ou 20%).
                </span>
              </div>

              <div>
                <Label className="text-xs">Desconto de Adiantamento (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="mt-1 h-9"
                  value={formData.descontoAdiantamento}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      descontoAdiantamento: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-2.5 border rounded-md">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Férias Vencidas</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Existe 1 período aquisitivo pendente
                  </p>
                </div>
                <Switch
                  checked={formData.feriasVencidas}
                  onCheckedChange={(c) => setFormData((prev) => ({ ...prev, feriasVencidas: c }))}
                />
              </div>
            </div>

            {/* Linha 4: Médias Variáveis apuradas */}
            <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-md text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-900 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Média de Verbas Variáveis Apuradas para a Rescisão
                </span>
                <span className="font-mono text-blue-800 font-bold">
                  Média: R$ {previewMedias.media.toFixed(2)} / mês
                </span>
              </div>
              {previewMedias.itens.length > 0 ? (
                <div className="max-h-20 overflow-y-auto space-y-1 font-mono text-[11px] text-blue-700">
                  {previewMedias.itens.map((it, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>
                        {it.competencia} - {it.verba}
                      </span>
                      <span>R$ {it.valor.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic text-[11px]">
                  Sem verbas variáveis nos últimos 12 meses. O cálculo segue pelo salário base.
                </p>
              )}
            </div>

            {/* SIMULAÇÃO EM TEMPO REAL */}
            {simulacaoClt && (
              <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Demonstrativo em Tempo Real CLT
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Tempo de Casa:</span>
                    <span className="font-bold">{simulacaoClt.anosCompletosTrabalhados} anos</span>
                    <span className="text-muted-foreground">• Aviso Lei 12.506:</span>
                    <span className="font-bold text-primary">
                      {simulacaoClt.diasAvisoPrevioLei12506} dias
                    </span>
                  </div>
                </div>

                {/* Rubricas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">
                      Proventos Rescisórios:
                    </span>
                    <div className="space-y-1 pt-1 font-mono">
                      <div className="flex justify-between">
                        <span>Saldo de Salário ({simulacaoClt.diasSaldoSalario}d):</span>
                        <span>R$ {simulacaoClt.saldoSalarioValor.toFixed(2)}</span>
                      </div>
                      {simulacaoClt.avisoPrevioIndenizadoValor > 0 && (
                        <div className="flex justify-between">
                          <span>Aviso Prévio Indenizado:</span>
                          <span>R$ {simulacaoClt.avisoPrevioIndenizadoValor.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>13º Proporcional (+ projeção):</span>
                        <span>
                          R${' '}
                          {(
                            simulacaoClt.decimoTerceiroProporcionalValor +
                            simulacaoClt.decimoTerceiroIndenizadoAviso
                          ).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Férias (+ 1/3 e projeção):</span>
                        <span>
                          R${' '}
                          {(
                            simulacaoClt.feriasVencidasValor +
                            simulacaoClt.tercoFeriasVencidas +
                            simulacaoClt.feriasProporcionaisValor +
                            simulacaoClt.tercoFeriasProporcionais +
                            simulacaoClt.feriasIndenizadasAviso
                          ).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold pt-1 border-t text-foreground">
                        <span>Total Bruto:</span>
                        <span>R$ {simulacaoClt.totalBrutoRescisao.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground">
                      Descontos e Multa FGTS:
                    </span>
                    <div className="space-y-1 pt-1 font-mono">
                      <div className="flex justify-between text-rose-600">
                        <span>INSS Previdência:</span>
                        <span>- R$ {simulacaoClt.descontoInss.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-rose-600">
                        <span>IRRF Retido:</span>
                        <span>- R$ {simulacaoClt.descontoIrrf.toFixed(2)}</span>
                      </div>
                      {simulacaoClt.descontoAvisoNaoCumprido > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Aviso Não Cumprido:</span>
                          <span>- R$ {simulacaoClt.descontoAvisoNaoCumprido.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-primary font-sans pt-1 border-t">
                        <span className="font-medium">
                          Multa Rescisória FGTS ({simulacaoClt.aliquotaMultaFgts}%):
                        </span>
                        <span className="font-bold">
                          R$ {simulacaoClt.valorMultaFgts.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold pt-1 border-t text-emerald-600 font-sans text-sm">
                        <span>Líquido a Pagar:</span>
                        <span>R$ {simulacaoClt.totalLiquidoRescisao.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alertas CLT gerados em tempo real */}
                {simulacaoClt.alertasConformidade.length > 0 && (
                  <div className="pt-2 border-t space-y-1">
                    {simulacaoClt.alertasConformidade.map((al, idx) => (
                      <div
                        key={idx}
                        className={`text-[11px] p-2 rounded flex items-start gap-1.5 ${
                          al.tipo === 'infracao'
                            ? 'bg-rose-50 text-rose-900 border border-rose-200'
                            : 'bg-amber-50 text-amber-900 border border-amber-200'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">{al.regra}: </span>
                          <span>{al.mensagem}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNovaRescisaoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGravarSimulacao} disabled={loading || !selectedFuncionario}>
              {loading ? 'Calculando...' : 'Gravar Rescisão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: TERMO DE RESCISÃO DO CONTRATO DE TRABALHO (TRCT) IMPRIMÍVEL */}
      <Dialog open={isTrctModalOpen} onOpenChange={setIsTrctModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base">
              <span>Termo de Rescisão do Contrato de Trabalho (TRCT) - Portaria MTE nº 1.057</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.print()}
                className="print:hidden"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir TRCT
              </Button>
            </DialogTitle>
          </DialogHeader>

          {selectedRescisaoTrct && (
            <div className="p-6 border rounded-lg bg-card text-foreground font-sans space-y-6 text-sm">
              {/* Cabeçalho Empregador */}
              <div className="border-b pb-4">
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-bold text-base uppercase">
                      {selectedRescisaoTrct.expand?.empresa?.razao_social || 'Empresa Empregadora'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      CNPJ: {selectedRescisaoTrct.expand?.empresa?.cnpj || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="font-mono text-xs">
                      TRCT Oficial CLT
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      Código e-Social: {selectedRescisaoTrct.codigo_afastamento_esocial}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dados do Contrato e Trabalhador */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/20 rounded text-xs">
                <div>
                  <span className="text-muted-foreground block">Trabalhador</span>
                  <span className="font-bold">
                    {selectedRescisaoTrct.expand?.funcionario?.nome_completo}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">CPF</span>
                  <span className="font-mono">{selectedRescisaoTrct.expand?.funcionario?.cpf}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Admissão</span>
                  <span>
                    {selectedRescisaoTrct.expand?.funcionario?.data_admissao
                      ? new Date(
                          selectedRescisaoTrct.expand.funcionario.data_admissao,
                        ).toLocaleDateString('pt-BR')
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Desligamento</span>
                  <span className="font-bold text-foreground">
                    {new Date(selectedRescisaoTrct.data_desligamento).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Causa do Afastamento</span>
                  <span>{formatMotivo(selectedRescisaoTrct.motivo_desligamento)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Aviso Prévio</span>
                  <span>
                    {selectedRescisaoTrct.dias_aviso_previo} dias (
                    {selectedRescisaoTrct.tipo_aviso_previo})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Salário Base + Médias</span>
                  <span className="font-mono">
                    R${' '}
                    {(
                      selectedRescisaoTrct.salario_base +
                      (selectedRescisaoTrct.media_variaveis || 0)
                    ).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Prazo Quitação (Art. 477)</span>
                  <span className="font-semibold text-primary">
                    {new Date(selectedRescisaoTrct.prazo_pagamento_limite).toLocaleDateString(
                      'pt-BR',
                    )}
                  </span>
                </div>
              </div>

              {/* Discriminativo das Verbas Rescisórias */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 text-muted-foreground">
                  Discriminativo das Verbas Rescisórias
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rubrica / Descrição</TableHead>
                      <TableHead className="text-right">Proventos (R$)</TableHead>
                      <TableHead className="text-right">Descontos (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedRescisaoTrct.verbas_rescisorias_detalhadas?.map((vb, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground mr-2">
                            [{vb.rubrica}]
                          </span>
                          {vb.descricao}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {vb.tipo === 'provento'
                            ? vb.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right text-rose-600">
                          {vb.tipo === 'desconto'
                            ? vb.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totais do TRCT e FGTS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Bruto de Proventos:</span>
                    <span className="font-bold">
                      R${' '}
                      {selectedRescisaoTrct.total_bruto_rescisao.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>Total de Deduções:</span>
                    <span>
                      - R${' '}
                      {selectedRescisaoTrct.total_descontos_rescisao.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold pt-1 border-t text-emerald-600">
                    <span>VALOR LÍQUIDO RESCISÓRIO:</span>
                    <span>
                      R${' '}
                      {selectedRescisaoTrct.total_liquido_rescisao.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-xs border-t md:border-t-0 md:border-l md:pl-4 pt-2 md:pt-0">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Saldo FGTS Base:</span>
                    <span>
                      R${' '}
                      {selectedRescisaoTrct.saldo_fgts_para_fins_rescisorios?.toLocaleString(
                        'pt-BR',
                        { minimumFractionDigits: 2 },
                      ) || '0,00'}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-primary">
                    <span>
                      Multa Rescisória do FGTS ({selectedRescisaoTrct.aliquota_multa_fgts}%):
                    </span>
                    <span>
                      R${' '}
                      {selectedRescisaoTrct.valor_multa_rescisoria_fgts?.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      }) || '0,00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t">
                    <span>Código de Saque FGTS:</span>
                    <span className="font-mono font-bold text-foreground">
                      {selectedRescisaoTrct.saque_fgts_autorizado
                        ? selectedRescisaoTrct.codigo_saque_fgts
                        : 'Bloqueado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Assinaturas */}
              <div className="pt-8 flex justify-between text-xs text-center border-t border-dashed">
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

function formatMotivo(m: RescisaoMotivo): string {
  switch (m) {
    case 'sem_justa_causa_empregador':
      return 'Dispensa sem justa causa'
    case 'justa_causa_empregador':
      return 'Demissão com justa causa'
    case 'pedido_demissao':
      return 'Pedido de demissão'
    case 'acordo_consensual_art_484_a':
      return 'Acordo mútuo (Art. 484-A CLT)'
    case 'termino_contrato_experiencia':
      return 'Término de experiência'
    case 'rescisao_indireta':
      return 'Rescisão indireta'
    case 'aposentadoria':
      return 'Aposentadoria'
    default:
      return m
  }
}

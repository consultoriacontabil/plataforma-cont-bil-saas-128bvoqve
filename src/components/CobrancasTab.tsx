import React, { useState, useEffect, useCallback } from 'react'
import {
  CreditCard,
  Plus,
  QrCode,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Check,
  AlertCircle,
  Filter,
  DollarSign,
  Calendar,
  Building,
  FileText,
  ExternalLink,
  Loader2,
  ArrowUpDown,
  Search,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { useToast } from '@/hooks/use-toast'
import { formatDateTimePtBr } from '@/lib/formatters'
import { cobrancasService } from '@/services/cobrancas'
import { whatsappAtivoService } from '@/services/whatsappAtivo'
import { gerarPayloadPixEmv } from '@/lib/pixEmv'
import type { Empresa, CobrancaRecord, CobrancaStatus, CobrancaTipo } from '@/types'
import pb from '@/lib/pocketbase/client'

interface CobrancasTabProps {
  tenantId: string
  empresas: Empresa[]
  canManage: boolean
}

export function CobrancasTab({ tenantId, empresas, canManage }: CobrancasTabProps) {
  const { toast } = useToast()

  // Lista de cobranças
  const [cobrancas, setCobrancas] = useState<CobrancaRecord[]>([])
  const [loading, setLoading] = useState(false)

  // Filtros
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todas')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [buscaTexto, setBuscaTexto] = useState<string>('')

  // Configuração padrão de PIX do escritório (obtida de nfse_config)
  const [chavePixPadrao, setChavePixPadrao] = useState<string>('')
  const [beneficiarioPadrao, setBeneficiarioPadrao] = useState<string>('')

  // Status Evolution API
  const [statusEvo, setStatusEvo] = useState<{ configurado: boolean; instance: string }>({
    configurado: false,
    instance: '',
  })

  // Modal de Criação / Edição
  const [modalOpen, setModalOpen] = useState(false)
  const [cobrancaEditando, setCobrancaEditando] = useState<CobrancaRecord | null>(null)
  const [empresaIdForm, setEmpresaIdForm] = useState<string>('')
  const [tipoForm, setTipoForm] = useState<CobrancaTipo>('pix')
  const [descricaoForm, setDescricaoForm] = useState<string>('')
  const [competenciaForm, setCompetenciaForm] = useState<string>('')
  const [valorForm, setValorForm] = useState<string>('')
  const [vencimentoForm, setVencimentoForm] = useState<string>('')
  const [chavePixForm, setChavePixForm] = useState<string>('')
  const [beneficiarioForm, setBeneficiarioForm] = useState<string>('')
  const [codigoBarrasForm, setCodigoBarrasForm] = useState<string>('')
  const [linkBoletoForm, setLinkBoletoForm] = useState<string>('')
  const [observacoesForm, setObservacoesForm] = useState<string>('')
  const [salvando, setSalvando] = useState(false)

  // Modal de QR Code / Detalhe PIX Copia-e-Cola
  const [modalPixOpen, setModalPixOpen] = useState(false)
  const [cobrancaVisualizando, setCobrancaVisualizando] = useState<CobrancaRecord | null>(null)
  const [copiadoPix, setCopiadoPix] = useState(false)

  // Disparo por WhatsApp
  const [disparandoId, setDisparandoId] = useState<string | null>(null)

  // Carregar dados de PIX padrão do escritório
  useEffect(() => {
    if (!tenantId) return
    const carregarConfigTenant = async () => {
      try {
        const cfg = await pb
          .collection('nfse_config')
          .getFirstListItem(`tenant_id = "${tenantId}"`)
          .catch(() => null)
        if (cfg) {
          setChavePixPadrao(cfg.chave_pix_padrao || '')
          setBeneficiarioPadrao(cfg.beneficiario_padrao || '')
        }
        const evo = await whatsappAtivoService.getStatusEvolutionTenant(tenantId)
        setStatusEvo(evo)
      } catch (err) {
        console.error('Erro ao carregar dados de integração:', err)
      }
    }
    carregarConfigTenant()
  }, [tenantId])

  // Carregar cobranças
  const carregarCobrancas = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const lista = await cobrancasService.list({
        empresaId: filtroEmpresa !== 'todas' ? filtroEmpresa : undefined,
        status: filtroStatus !== 'todos' ? (filtroStatus as CobrancaStatus) : undefined,
        tipo: filtroTipo !== 'todos' ? (filtroTipo as CobrancaTipo) : undefined,
      })
      setCobrancas(lista)
    } catch (err) {
      console.error('Erro ao listar cobranças:', err)
      toast({
        title: 'Erro ao carregar cobranças',
        description: 'Não foi possível buscar a lista de cobranças.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, filtroEmpresa, filtroStatus, filtroTipo, toast])

  useEffect(() => {
    carregarCobrancas()
  }, [carregarCobrancas])

  // Abrir modal de nova cobrança
  const handleAbrirNovaCobranca = () => {
    setCobrancaEditando(null)
    setEmpresaIdForm(empresas.length > 0 ? empresas[0].id : '')
    setTipoForm('pix')
    setDescricaoForm('Honorários Contábeis')
    const agora = new Date()
    const mes = String(agora.getMonth() + 1).padStart(2, '0')
    const ano = agora.getFullYear()
    setCompetenciaForm(`${mes}/${ano}`)
    setValorForm('750.00')

    // Próximo vencimento padrão: dia 10 do próximo mês
    const proxMes = new Date(ano, agora.getMonth() + 1, 10)
    setVencimentoForm(proxMes.toISOString().split('T')[0])

    setChavePixForm(chavePixPadrao)
    setBeneficiarioForm(beneficiarioPadrao || 'RUMO CONTABILIDADE')
    setCodigoBarrasForm('')
    setLinkBoletoForm('')
    setObservacoesForm('')
    setModalOpen(true)
  }

  // Abrir modal de edição de cobrança
  const handleAbrirEditarCobranca = (cob: CobrancaRecord) => {
    setCobrancaEditando(cob)
    setEmpresaIdForm(cob.empresa)
    setTipoForm(cob.tipo)
    setDescricaoForm(cob.descricao)
    setCompetenciaForm(cob.competencia || '')
    setValorForm(String(cob.valor || ''))
    setVencimentoForm(cob.vencimento ? cob.vencimento.split('T')[0] : '')
    setChavePixForm(cob.chave_pix || chavePixPadrao)
    setBeneficiarioForm(cob.beneficiario_nome || beneficiarioPadrao)
    setCodigoBarrasForm(cob.codigo_barras || '')
    setLinkBoletoForm(cob.link_boleto || '')
    setObservacoesForm(cob.observacoes || '')
    setModalOpen(true)
  }

  // Salvar cobrança (Criar ou Atualizar)
  const handleSalvarCobranca = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !empresaIdForm) {
      toast({
        title: 'Empresa obrigatória',
        description: 'Selecione uma empresa para a cobrança.',
        variant: 'destructive',
      })
      return
    }

    const valorNum = parseFloat(valorForm.replace(',', '.'))
    if (isNaN(valorNum) || valorNum <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor numérico positivo para a cobrança.',
        variant: 'destructive',
      })
      return
    }

    if (!vencimentoForm) {
      toast({
        title: 'Vencimento obrigatório',
        description: 'Informe a data de vencimento.',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      if (cobrancaEditando) {
        await cobrancasService.update(cobrancaEditando.id, {
          empresa: empresaIdForm,
          tipo: tipoForm,
          descricao: descricaoForm.trim(),
          competencia: competenciaForm.trim(),
          valor: valorNum,
          vencimento: vencimentoForm,
          chave_pix: chavePixForm.trim(),
          beneficiario_nome: beneficiarioForm.trim(),
          codigo_barras: codigoBarrasForm.trim(),
          link_boleto: linkBoletoForm.trim(),
          observacoes: observacoesForm.trim(),
        })
        toast({
          title: 'Cobrança atualizada',
          description: 'Os dados da cobrança e o payload PIX foram recalculados com sucesso.',
        })
      } else {
        await cobrancasService.create({
          tenant_id: tenantId,
          empresa: empresaIdForm,
          tipo: tipoForm,
          descricao: descricaoForm.trim(),
          competencia: competenciaForm.trim(),
          valor: valorNum,
          vencimento: vencimentoForm,
          chave_pix: chavePixForm.trim(),
          beneficiario_nome: beneficiarioForm.trim(),
          codigo_barras: codigoBarrasForm.trim(),
          link_boleto: linkBoletoForm.trim(),
          observacoes: observacoesForm.trim(),
        })
        toast({
          title: 'Cobrança criada',
          description: 'A cobrança foi registrada com payload EMV BR Code PIX estático gerado.',
        })
      }
      setModalOpen(false)
      carregarCobrancas()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Erro ao salvar cobrança',
        description: errMsg,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Marcar como Pago (Baixa manual auditada)
  const handleMarcarComoPago = async (cob: CobrancaRecord) => {
    try {
      await cobrancasService.marcarComoPago({
        id: cob.id,
        pago_em: new Date().toISOString(),
        pago_valor: cob.valor,
      })
      toast({
        title: 'Cobrança baixada',
        description: `Cobrança "${cob.descricao}" marcada como paga com sucesso!`,
      })
      carregarCobrancas()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Erro na baixa',
        description: errMsg,
        variant: 'destructive',
      })
    }
  }

  // Cancelar cobrança
  const handleCancelarCobranca = async (cob: CobrancaRecord) => {
    if (!window.confirm(`Deseja realmente cancelar a cobrança "${cob.descricao}"?`)) return
    try {
      await cobrancasService.cancelar(cob.id, 'Cancelado manualmente pelo usuário')
      toast({
        title: 'Cobrança cancelada',
        description: 'Status alterado para cancelado.',
      })
      carregarCobrancas()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Erro ao cancelar',
        description: errMsg,
        variant: 'destructive',
      })
    }
  }

  // Enviar aviso de cobrança via WhatsApp
  const handleDispararWhatsApp = async (cob: CobrancaRecord) => {
    const emp = empresas.find((e) => e.id === cob.empresa)
    if (!emp) {
      toast({
        title: 'Empresa não encontrada',
        description: 'Não foi possível localizar os dados da empresa vinculada à cobrança.',
        variant: 'destructive',
      })
      return
    }

    setDisparandoId(cob.id)
    try {
      const resp = await cobrancasService.enviarPorWhatsApp({
        cobranca: cob,
        empresa: emp,
        origem: 'manual',
      })

      if (resp.status === 'enviado') {
        toast({
          title: 'Cobrança enviada por WhatsApp!',
          description:
            'A mensagem real com chave PIX e detalhes foi transmitida com sucesso via Evolution API.',
        })
      } else if (resp.status === 'aguardando_credenciais') {
        toast({
          title: 'Modo Supervisão (Aguardando Credenciais)',
          description:
            'A cobrança foi registrada na fila de WhatsApp. Para envio real aos clientes, configure as credenciais da Evolution API em Integrações → NFS-e & WhatsApp.',
        })
      } else {
        toast({
          title: 'Falha no disparo',
          description: resp.mensagem || 'Não foi possível concluir o envio por WhatsApp.',
          variant: 'destructive',
        })
      }
      carregarCobrancas()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Falha ao enviar cobrança',
        description: errMsg,
        variant: 'destructive',
      })
    } finally {
      setDisparandoId(null)
    }
  }

  // Copiar código PIX para a área de transferência
  const handleCopiarPix = (payload: string) => {
    navigator.clipboard.writeText(payload)
    setCopiadoPix(true)
    setTimeout(() => setCopiadoPix(false), 2500)
    toast({
      title: 'PIX Copia e Cola copiado!',
      description: 'Código EMV BR Code transferido para a área de transferência.',
    })
  }

  // Filtragem local por texto
  const cobrancasFiltradas = cobrancas.filter((c) => {
    if (!buscaTexto) return true
    const q = buscaTexto.toLowerCase()
    const desc = (c.descricao || '').toLowerCase()
    const comp = (c.competencia || '').toLowerCase()
    const empNome = (
      c.expand?.empresa?.razao_social ||
      c.expand?.empresa?.nome_fantasia ||
      ''
    ).toLowerCase()
    return desc.includes(q) || comp.includes(q) || empNome.includes(q)
  })

  // Estatísticas rápidas
  const totalPendente = cobrancas
    .filter((c) => c.status === 'pendente')
    .reduce((acc, cur) => acc + (cur.valor || 0), 0)
  const totalPago = cobrancas
    .filter((c) => c.status === 'pago')
    .reduce((acc, cur) => acc + (cur.pago_valor || cur.valor || 0), 0)

  return (
    <div className="space-y-6 pt-2">
      {/* Banner Principal de Cobrança com PIX / Boleto */}
      <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-transparent p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0FA3A3] text-white shadow-sm">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#1A2333]">
                Cobrança por Boleto / PIX via WhatsApp
              </h3>
              <Badge className="bg-[#0FA3A3] text-white text-[10px] font-semibold">
                EMV BR Code Estático
              </Badge>
            </div>
            <p className="text-xs text-[#475569] mt-0.5 max-w-2xl leading-relaxed">
              Gere faturas e cobranças com chave PIX (payload copia-e-cola homologado no padrão
              BACEN com CRC16-CCITT) e dispare avisos automáticos aos clientes no WhatsApp via
              Evolution API.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {!statusEvo.configurado ? (
            <div className="flex flex-col items-end gap-1">
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-300 text-[11px] py-1 px-3 font-medium flex items-center gap-1.5 shadow-2xs"
              >
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                Evolution API: Modo Supervisão
              </Badge>
              <a
                href="/integracoes"
                className="text-[11px] text-[#0FA3A3] hover:underline flex items-center gap-1 font-medium"
              >
                Configurar credenciais
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : (
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[11px] py-1 px-3 font-medium flex items-center gap-1.5 shadow-2xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Evolution API Conectada ({statusEvo.instance})
            </Badge>
          )}

          {canManage && (
            <Button
              onClick={handleAbrirNovaCobranca}
              className="bg-[#0FA3A3] hover:bg-[#0c8787] text-white text-xs font-semibold gap-1.5 h-9 rounded-xl shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Nova Cobrança
            </Button>
          )}
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-xl border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pendentes para Receber</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-xl font-bold text-slate-800">
            {totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {cobrancas.filter((c) => c.status === 'pendente').length} faturas aguardando pagamento
          </span>
        </Card>

        <Card className="rounded-xl border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Recebido / Baixado</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-700">
            {totalPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {cobrancas.filter((c) => c.status === 'pago').length} faturas quitadas
          </span>
        </Card>

        <Card className="rounded-xl border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Meio de Pagamento Ativo</span>
            <QrCode className="h-4 w-4 text-[#0FA3A3]" />
          </div>
          <div
            className="mt-2 text-sm font-semibold text-slate-800 truncate"
            title={chavePixPadrao || 'Chave PIX não informada'}
          >
            {chavePixPadrao ? `PIX: ${chavePixPadrao}` : 'Chave PIX do escritório não configurada'}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {beneficiarioPadrao || 'Configure em Integrações → NFS-e & WhatsApp'}
          </span>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="rounded-xl border-slate-200 p-4 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600">Buscar</Label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                value={buscaTexto}
                onChange={(e) => setBuscaTexto(e.target.value)}
                placeholder="Descrição, competência..."
                className="h-8 pl-8 text-xs rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600">Empresa</Label>
            <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
              <SelectTrigger className="h-8 text-xs rounded-lg">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas" className="text-xs">
                  Todas as Empresas
                </SelectItem>
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs">
                    {emp.nome_fantasia || emp.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600">Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-8 text-xs rounded-lg">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos os Status
                </SelectItem>
                <SelectItem value="pendente" className="text-xs">
                  Pendente
                </SelectItem>
                <SelectItem value="pago" className="text-xs">
                  Pago
                </SelectItem>
                <SelectItem value="cancelado" className="text-xs">
                  Cancelado
                </SelectItem>
                <SelectItem value="vencido" className="text-xs">
                  Vencido
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-slate-600">Tipo de Cobrança</Label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="h-8 text-xs rounded-lg">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos os Meios
                </SelectItem>
                <SelectItem value="pix" className="text-xs">
                  PIX (Chave / Copia e Cola)
                </SelectItem>
                <SelectItem value="boleto" className="text-xs">
                  Boleto Bancário
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Tabela de Cobranças */}
      <Card className="rounded-2xl border-slate-200 overflow-hidden shadow-2xs">
        <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#0FA3A3]" />
                Cobranças Cadastradas ({cobrancasFiltradas.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Controle de honorários, envio por WhatsApp e rastreamento de liquidação
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={carregarCobrancas}
              disabled={loading}
              className="text-xs h-8 gap-1.5"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Atualizar'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-[#0FA3A3]" />
              Carregando cobranças...
            </div>
          ) : cobrancasFiltradas.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500 space-y-2">
              <CreditCard className="h-8 w-8 mx-auto text-slate-300" />
              <p className="font-semibold text-slate-700">Nenhuma cobrança encontrada</p>
              <p className="text-slate-400">
                Clique em "Nova Cobrança" para registrar honorários com chave PIX e disparar via
                WhatsApp.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/70 text-slate-500 border-b border-slate-100 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Empresa</th>
                    <th className="py-3 px-4">Descrição & Comp.</th>
                    <th className="py-3 px-4">Meio</th>
                    <th className="py-3 px-4">Vencimento</th>
                    <th className="py-3 px-4 text-right">Valor</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">WhatsApp</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cobrancasFiltradas.map((cob) => {
                    const emp = cob.expand?.empresa || empresas.find((e) => e.id === cob.empresa)
                    const vencStr = cob.vencimento ? cob.vencimento.split('T')[0] : '—'
                    const [vAno, vMes, vDia] = vencStr.split('-')
                    const vencFmt = vDia && vMes && vAno ? `${vDia}/${vMes}/${vAno}` : vencStr

                    return (
                      <tr key={cob.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {emp ? emp.nome_fantasia || emp.razao_social : 'Empresa não vinculada'}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{cob.descricao}</div>
                          {cob.competencia && (
                            <div className="text-[10px] text-slate-400">
                              Comp: {cob.competencia}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={
                              cob.tipo === 'pix'
                                ? 'border-teal-200 bg-teal-50 text-teal-800 text-[10px]'
                                : 'border-blue-200 bg-blue-50 text-blue-800 text-[10px]'
                            }
                          >
                            {cob.tipo.toUpperCase()}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 text-slate-600 font-mono">{vencFmt}</td>

                        <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                          {cob.valor.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {cob.status === 'pago' ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Pago
                            </Badge>
                          ) : cob.status === 'pendente' ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] gap-1">
                              <Clock className="h-3 w-3" /> Pendente
                            </Badge>
                          ) : cob.status === 'vencido' ? (
                            <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] gap-1">
                              <XCircle className="h-3 w-3" /> Vencido
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {cob.status}
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {cob.whatsapp_envio_id ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-slate-50 border-slate-200 text-slate-600"
                            >
                              Disparado
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-slate-400">Não enviado</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Ver PIX / QR Code */}
                            {cob.tipo === 'pix' && cob.payload_pix && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setCobrancaVisualizando(cob)
                                  setModalPixOpen(true)
                                }}
                                className="h-7 px-2 text-[11px] gap-1 border-teal-200 text-teal-800 hover:bg-teal-50"
                                title="Ver PIX Copia e Cola / QR Code"
                              >
                                <QrCode className="h-3.5 w-3.5" />
                                PIX
                              </Button>
                            )}

                            {/* Disparar WhatsApp */}
                            {canManage && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDispararWhatsApp(cob)}
                                disabled={disparandoId === cob.id}
                                className="h-7 px-2 text-[11px] gap-1 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                                title="Disparar fatura no WhatsApp"
                              >
                                {disparandoId === cob.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Send className="h-3 w-3" />
                                )}
                                WhatsApp
                              </Button>
                            )}

                            {/* Marcar como Pago */}
                            {canManage && cob.status !== 'pago' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMarcarComoPago(cob)}
                                className="h-7 px-2 text-[11px] gap-1 border-slate-200 text-slate-700 hover:bg-slate-100"
                                title="Marcar como pago (baixa manual)"
                              >
                                <Check className="h-3 w-3 text-emerald-600" />
                                Pagar
                              </Button>
                            )}

                            {/* Editar */}
                            {canManage && cob.status !== 'pago' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAbrirEditarCobranca(cob)}
                                className="h-7 px-2 text-[11px] text-slate-500 hover:text-slate-800"
                              >
                                Editar
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Nova / Editar Cobrança */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <form onSubmit={handleSalvarCobranca}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#0FA3A3]" />
                {cobrancaEditando ? 'Editar Cobrança' : 'Nova Cobrança por Boleto / PIX'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Informe os parâmetros da cobrança para cálculo do BR Code PIX estático (padrão
                BACEN) e envio no WhatsApp.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Empresa Destinatária *</Label>
                  <Select value={empresaIdForm} onValueChange={setEmpresaIdForm}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs">
                          {emp.nome_fantasia || emp.razao_social}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Meio de Pagamento *</Label>
                  <Select value={tipoForm} onValueChange={(val: CobrancaTipo) => setTipoForm(val)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix" className="text-xs">
                        PIX (Chave / BR Code)
                      </SelectItem>
                      <SelectItem value="boleto" className="text-xs">
                        Boleto Bancário
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold">Descrição do Serviço / Fatura *</Label>
                  <Input
                    value={descricaoForm}
                    onChange={(e) => setDescricaoForm(e.target.value)}
                    placeholder="Ex: Honorários Contábeis Mensais"
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Competência (MM/AAAA)</Label>
                  <Input
                    value={competenciaForm}
                    onChange={(e) => setCompetenciaForm(e.target.value)}
                    placeholder="Ex: 09/2026"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Valor da Fatura (R$) *</Label>
                  <Input
                    value={valorForm}
                    onChange={(e) => setValorForm(e.target.value)}
                    placeholder="Ex: 750.00"
                    className="h-9 text-xs font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Data de Vencimento *</Label>
                  <Input
                    type="date"
                    value={vencimentoForm}
                    onChange={(e) => setVencimentoForm(e.target.value)}
                    className="h-9 text-xs font-mono"
                    required
                  />
                </div>
              </div>

              {/* Meio de Pagamento: PIX */}
              {tipoForm === 'pix' && (
                <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3.5 space-y-3">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-[#0FA3A3]" />
                    <span className="font-bold text-slate-800 text-xs">
                      Parâmetros do PIX Estático (EMV BR Code)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-700">
                        Chave PIX Recebedor
                      </Label>
                      <Input
                        value={chavePixForm}
                        onChange={(e) => setChavePixForm(e.target.value)}
                        placeholder="Ex: 12.345.678/0001-90 ou financeiro@rumo.com"
                        className="h-8 text-xs bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-700">
                        Nome do Beneficiário
                      </Label>
                      <Input
                        value={beneficiarioForm}
                        onChange={(e) => setBeneficiarioForm(e.target.value)}
                        placeholder="Ex: RUMO CONTABILIDADE LTDA"
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-teal-800">
                    O código copia-e-cola é gerado automaticamente com o padrão EMV (GUI
                    br.gov.bcb.pix e CRC16-CCITT 0x1021).
                  </p>
                </div>
              )}

              {/* Meio de Pagamento: Boleto */}
              {tipoForm === 'boleto' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="font-bold text-slate-800 text-xs">
                      Dados do Boleto Bancário
                    </span>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">
                      Linha Digitável / Código de Barras
                    </Label>
                    <Input
                      value={codigoBarrasForm}
                      onChange={(e) => setCodigoBarrasForm(e.target.value)}
                      placeholder="Ex: 34191.79001 01043.510047 91020.150008 5 91230000075000"
                      className="h-8 text-xs bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">
                      Link Público do PDF do Boleto
                    </Label>
                    <Input
                      value={linkBoletoForm}
                      onChange={(e) => setLinkBoletoForm(e.target.value)}
                      placeholder="https://..."
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Observações Internas</Label>
                <Textarea
                  value={observacoesForm}
                  onChange={(e) => setObservacoesForm(e.target.value)}
                  placeholder="Informações adicionais para auditoria..."
                  className="h-16 text-xs resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvando}
                className="bg-[#0FA3A3] hover:bg-[#0c8787] text-white text-xs gap-1.5"
              >
                {salvando ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Cobrança'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Visualizar PIX Copia e Cola / QR Code */}
      <Dialog open={modalPixOpen} onOpenChange={setModalPixOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
              <QrCode className="h-5 w-5 text-[#0FA3A3]" />
              PIX Copia e Cola (Padrão BACEN)
            </DialogTitle>
            <DialogDescription className="text-xs">
              {cobrancaVisualizando?.descricao} — R${' '}
              {cobrancaVisualizando?.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </DialogDescription>
          </DialogHeader>

          {cobrancaVisualizando?.payload_pix && (
            <div className="space-y-4 py-2">
              <div className="flex justify-center p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                {/* QR Code gerado via URL do Skip CDN / SVG estático */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                    cobrancaVisualizando.payload_pix,
                  )}`}
                  alt="QR Code PIX"
                  className="w-48 h-48 rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-slate-700">
                  Código EMV PIX Copia e Cola
                </Label>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono break-all text-slate-700 max-h-24 overflow-y-auto">
                  {cobrancaVisualizando.payload_pix}
                </div>
              </div>

              <Button
                onClick={() => handleCopiarPix(cobrancaVisualizando.payload_pix || '')}
                className="w-full bg-[#0FA3A3] hover:bg-[#0c8787] text-white text-xs gap-1.5 h-9"
              >
                {copiadoPix ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiadoPix ? 'PIX Copiado!' : 'Copiar Código PIX'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

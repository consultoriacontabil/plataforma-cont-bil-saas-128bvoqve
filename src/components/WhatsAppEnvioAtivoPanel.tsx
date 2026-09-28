import React, { useState, useEffect, useCallback } from 'react'
import {
  Send,
  MessageSquare,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  ExternalLink,
  History,
  FileText,
  DollarSign,
  TrendingUp,
  FolderOpen,
  Bell,
  RefreshCw,
  Phone,
  Check,
  CreditCard,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { whatsappAtivoService, type SalvarAutorizacaoInput } from '@/services/whatsappAtivo'
import type {
  Empresa,
  WhatsAppNotificacoesAutorizadasRecord,
  WhatsAppEnvioRecord,
  WhatsAppEnvioTipo,
  ObrigacaoRecord,
  GuiaPagamentoRecord,
  DemonstrativoRecord,
  Documento,
} from '@/types'
import pb from '@/lib/pocketbase/client'

interface WhatsAppEnvioAtivoPanelProps {
  tenantId: string
  empresas: Empresa[]
  canManage: boolean
}

export function WhatsAppEnvioAtivoPanel({
  tenantId,
  empresas,
  canManage,
}: WhatsAppEnvioAtivoPanelProps) {
  const { toast } = useToast()

  // Empresa selecionada
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('')
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [salvandoConfig, setSalvandoConfig] = useState(false)

  // Status Evolution API no Tenant
  const [statusEvo, setStatusEvo] = useState<{
    configurado: boolean
    url: string
    instance: string
  }>({ configurado: false, url: '', instance: '' })

  // Preferências da Empresa
  const [autorizacao, setAutorizacao] = useState<WhatsAppNotificacoesAutorizadasRecord | null>(null)
  const [telefone, setTelefone] = useState('')
  const [permiteAvisos, setPermiteAvisos] = useState(true)
  const [permiteGuias, setPermiteGuias] = useState(true)
  const [permitePrevias, setPermitePrevias] = useState(true)
  const [permiteDemonstrativos, setPermiteDemonstrativos] = useState(true)
  const [permiteDocumentos, setPermiteDocumentos] = useState(true)
  const [permiteCobrancas, setPermiteCobrancas] = useState(true)
  const [observacoes, setObservacoes] = useState('')

  // Histórico de Envios
  const [envios, setEnvios] = useState<WhatsAppEnvioRecord[]>([])
  const [loadingEnvios, setLoadingEnvios] = useState(false)

  // Modal de Disparo Sob Demanda
  const [modalDisparoOpen, setModalDisparoOpen] = useState(false)
  const [tipoDisparo, setTipoDisparo] = useState<WhatsAppEnvioTipo>('aviso')
  const [mensagemPersonalizada, setMensagemPersonalizada] = useState('')
  const [referenciaItem, setReferenciaItem] = useState('')
  const [disparando, setDisparando] = useState(false)

  // Itens para carregar sob demanda no modal
  const [obrigacoes, setObrigacoes] = useState<ObrigacaoRecord[]>([])
  const [guias, setGuias] = useState<GuiaPagamentoRecord[]>([])
  const [demonstrativos, setDemonstrativos] = useState<DemonstrativoRecord[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loadingItens, setLoadingItens] = useState(false)

  // Definir empresa inicial
  useEffect(() => {
    if (empresas.length > 0 && !selectedEmpresaId) {
      setSelectedEmpresaId(empresas[0].id)
    }
  }, [empresas, selectedEmpresaId])

  // Checar credenciais do tenant
  useEffect(() => {
    if (!tenantId) return
    whatsappAtivoService.getStatusEvolutionTenant(tenantId).then(setStatusEvo)
  }, [tenantId])

  const selectedEmpresa = empresas.find((e) => e.id === selectedEmpresaId)

  // Carregar configurações da empresa selecionada e histórico
  const carregarDadosEmpresa = useCallback(
    async (empId: string) => {
      if (!tenantId || !empId) return
      setLoadingConfig(true)
      setLoadingEnvios(true)
      try {
        const [authRec, enviosList] = await Promise.all([
          whatsappAtivoService.getAutorizacaoEmpresa(tenantId, empId),
          whatsappAtivoService.listEnviosPorEmpresa(tenantId, empId),
        ])

        const empAtual = empresas.find((e) => e.id === empId)

        setAutorizacao(authRec)
        setTelefone(authRec?.telefone_destinatario || empAtual?.telefone || '')
        setPermiteAvisos(authRec ? !!authRec.permitir_avisos : true)
        setPermiteGuias(authRec ? !!authRec.permitir_guias : true)
        setPermitePrevias(authRec ? !!authRec.permitir_previas : true)
        setPermiteDemonstrativos(authRec ? !!authRec.permitir_demonstrativos : true)
        setPermiteDocumentos(authRec ? !!authRec.permitir_documentos : true)
        setPermiteCobrancas(authRec ? authRec.permitir_cobrancas !== false : true)
        setObservacoes(authRec?.observacoes || '')

        setEnvios(enviosList)
      } catch (err) {
        console.error('Erro ao carregar dados de whatsapp ativo da empresa:', err)
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar dados',
          description: 'Não foi possível carregar as preferências de WhatsApp desta empresa.',
        })
      } finally {
        setLoadingConfig(false)
        setLoadingEnvios(false)
      }
    },
    [tenantId, empresas, toast],
  )

  useEffect(() => {
    if (selectedEmpresaId) {
      carregarDadosEmpresa(selectedEmpresaId)
    }
  }, [selectedEmpresaId, carregarDadosEmpresa])

  // Salvar preferências da empresa
  const handleSalvarPreferencias = async () => {
    if (!tenantId || !selectedEmpresaId) return
    setSalvandoConfig(true)
    try {
      const payload: SalvarAutorizacaoInput = {
        tenant_id: tenantId,
        empresa: selectedEmpresaId,
        telefone_destinatario: telefone.trim(),
        permitir_avisos: permiteAvisos,
        permitir_guias: permiteGuias,
        permitir_previas: permitePrevias,
        permitir_demonstrativos: permiteDemonstrativos,
        permitir_documentos: permiteDocumentos,
        permitir_cobrancas: permiteCobrancas,
        ativo: true,
        observacoes: observacoes.trim(),
      }
      const saved = await whatsappAtivoService.salvarAutorizacao(payload)
      setAutorizacao(saved)
      toast({
        title: 'Preferências salvas!',
        description: 'Autorizações de envio ativo atualizadas com sucesso para esta empresa.',
      })
    } catch (err) {
      console.error('Erro ao salvar autorizações:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível persistir as preferências de envio ativo.',
      })
    } finally {
      setSalvandoConfig(false)
    }
  }

  // Abrir modal de disparo sob demanda
  const handleAbrirModalDisparo = async (tipo: WhatsAppEnvioTipo = 'aviso') => {
    setTipoDisparo(tipo)
    setReferenciaItem('')
    setModalDisparoOpen(true)
    setLoadingItens(true)

    try {
      // Carregar itens reais da empresa
      const [obrs, gs, dems, docs] = await Promise.all([
        pb
          .collection('obrigacoes')
          .getFullList<ObrigacaoRecord>({
            filter: `tenant_id = "${tenantId}" && empresa_id = "${selectedEmpresaId}"`,
            sort: '-vencimento',
            limit: 20,
          })
          .catch(() => []),
        pb
          .collection('guias_pagamentos')
          .getFullList<GuiaPagamentoRecord>({
            filter: `tenant_id = "${tenantId}" && empresa = "${selectedEmpresaId}"`,
            sort: '-data_vencimento',
            limit: 20,
          })
          .catch(() => []),
        pb
          .collection('demonstrativos')
          .getFullList<DemonstrativoRecord>({
            filter: `tenant_id = "${tenantId}" && empresa = "${selectedEmpresaId}"`,
            sort: '-competencia',
            limit: 20,
          })
          .catch(() => []),
        pb
          .collection('documentos')
          .getFullList<Documento>({
            filter: `tenant_id = "${tenantId}" && empresa_id = "${selectedEmpresaId}"`,
            sort: '-created',
            limit: 20,
          })
          .catch(() => []),
      ])

      setObrigacoes(obrs)
      setGuias(gs)
      setDemonstrativos(dems)
      setDocumentos(docs)

      // Montar template inicial se houver empresa
      if (selectedEmpresa) {
        atualizarMensagemPorTipo(tipo, '', obrs, gs, dems, docs)
      }
    } catch (err) {
      console.error('Erro ao carregar itens para disparo:', err)
    } finally {
      setLoadingItens(false)
    }
  }

  const atualizarMensagemPorTipo = (
    tipo: WhatsAppEnvioTipo,
    itemId: string,
    currentObrs = obrigacoes,
    currentGs = guias,
    currentDems = demonstrativos,
    currentDocs = documentos,
  ) => {
    if (!selectedEmpresa) return

    if (tipo === 'aviso') {
      const obr = currentObrs.find((o) => o.id === itemId) || currentObrs[0]
      if (obr) {
        setReferenciaItem(obr.id)
        setMensagemPersonalizada(
          whatsappAtivoService.gerarTemplateAvisoObrigacao({
            empresa: selectedEmpresa,
            obrigacao: obr,
          }),
        )
      } else {
        const dummyObr: ObrigacaoRecord = {
          id: 'manual',
          collectionId: '',
          collectionName: 'obrigacoes',
          created: '',
          updated: '',
          tenant_id: tenantId,
          empresa_id: selectedEmpresa.id,
          tipo: 'DAS',
          competencia: '09/2026',
          vencimento: '2026-10-20',
          status: 'pendente',
          valor: 1250.0,
        }
        setMensagemPersonalizada(
          whatsappAtivoService.gerarTemplateAvisoObrigacao({
            empresa: selectedEmpresa,
            obrigacao: dummyObr,
          }),
        )
      }
    } else if (tipo === 'guia') {
      const g = currentGs.find((item) => item.id === itemId) || currentGs[0]
      if (g) {
        setReferenciaItem(g.id)
        setMensagemPersonalizada(
          whatsappAtivoService.gerarTemplateGuiaPagamento({
            empresa: selectedEmpresa,
            guia: g,
          }),
        )
      } else {
        const dummyGuia: GuiaPagamentoRecord = {
          id: 'manual',
          created: '',
          updated: '',
          tenant_id: tenantId,
          empresa: selectedEmpresa.id,
          tipo_guia: 'das',
          codigo_receita: '1501',
          periodo_apuracao: '09/2026',
          valor_total: 1845.5,
          data_vencimento: '2026-10-20',
          situacao: 'pendente',
          origem: 'manual',
          autenticacao_bancaria: '858300000018455003820260900000000001',
        }
        setMensagemPersonalizada(
          whatsappAtivoService.gerarTemplateGuiaPagamento({
            empresa: selectedEmpresa,
            guia: dummyGuia,
          }),
        )
      }
    } else if (tipo === 'previa') {
      setMensagemPersonalizada(
        whatsappAtivoService.gerarTemplatePreviaApuracao({
          empresa: selectedEmpresa,
          competencia: '09/2026',
          resumoTexto:
            '• Simples Nacional / Anexo III\n• Faturamento acumulado no período: R$ 42.800,00\n• Alíquota efetiva apurada: 6,00%',
          estimativaValor: 2568.0,
        }),
      )
    } else if (tipo === 'demonstrativo') {
      const d = currentDems.find((item) => item.id === itemId) || currentDems[0]
      if (d) {
        setReferenciaItem(d.id)
        setMensagemPersonalizada(
          whatsappAtivoService.gerarTemplateDemonstrativo({
            empresa: selectedEmpresa,
            demonstrativo: d,
          }),
        )
      } else {
        const dummyDem: DemonstrativoRecord = {
          id: 'manual',
          collectionId: '',
          collectionName: 'demonstrativos',
          created: '',
          updated: '',
          tenant_id: tenantId,
          empresa: selectedEmpresa.id,
          competencia: '09/2026',
          tipo: 'dre',
          status: 'rascunho',
          dados: {},
        }
        setMensagemPersonalizada(
          whatsappAtivoService.gerarTemplateDemonstrativo({
            empresa: selectedEmpresa,
            demonstrativo: dummyDem,
          }),
        )
      }
    } else if (tipo === 'documento') {
      const doc = currentDocs.find((item) => item.id === itemId) || currentDocs[0]
      if (doc) {
        setReferenciaItem(doc.id)
        setMensagemPersonalizada(
          whatsappAtivoService.gerarTemplateDocumento({
            empresa: selectedEmpresa,
            documento: doc,
          }),
        )
      } else {
        const dummyDoc: Documento = {
          id: 'manual',
          collectionId: '',
          collectionName: 'documentos',
          created: '',
          updated: '',
          tenant_id: tenantId,
          empresa_id: selectedEmpresa.id,
          nome_arquivo: 'Contrato-Social-Registrado.pdf',
          tipo: 'contrato_social',
          status: 'processado',
          usuario_upload_id: '',
          data_upload: new Date().toISOString(),
        }
        setMensagemPersonalizada(
          whatsappAtivoService.gerarTemplateDocumento({
            empresa: selectedEmpresa,
            documento: dummyDoc,
          }),
        )
      }
    }
  }

  // Executar disparo
  const handleDispararEnvio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !selectedEmpresaId) return

    const numLimpo = telefone.replace(/\D/g, '')
    if (numLimpo.length < 10) {
      toast({
        variant: 'destructive',
        title: 'Telefone inválido',
        description: 'Informe um número de WhatsApp com DDD antes de enviar.',
      })
      return
    }

    setDisparando(true)
    try {
      const res = await whatsappAtivoService.dispararEnvio({
        tenant_id: tenantId,
        empresa_id: selectedEmpresaId,
        tipo: tipoDisparo,
        referencia: referenciaItem || `MANUAL-${Date.now()}`,
        destinatario: numLimpo,
        mensagem: mensagemPersonalizada.trim(),
        origem: 'manual',
      })

      if (res.status === 'aguardando_credenciais') {
        toast({
          title: 'Fila / Modo Supervisão',
          description:
            'Mensagem registrada em fila com status "aguardando credenciais". Configure em Integrações → NFS-e & WhatsApp para envio real.',
        })
      } else if (res.status === 'enviado') {
        toast({
          title: 'Disparo realizado!',
          description: 'A mensagem foi enviada com sucesso para o WhatsApp via Evolution API.',
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Falha no disparo',
          description: res.erro || 'Não foi possível transmitir a mensagem.',
        })
      }

      setModalDisparoOpen(false)
      carregarDadosEmpresa(selectedEmpresaId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao disparar',
        description: msg,
      })
    } finally {
      setDisparando(false)
    }
  }

  const getStatusBadge = (status: WhatsAppEnvioRecord['status']) => {
    switch (status) {
      case 'enviado':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1 text-[10px]">
            <CheckCircle2 className="h-3 w-3" /> Enviado
          </Badge>
        )
      case 'aguardando_credenciais':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 gap-1 text-[10px]">
            <Clock className="h-3 w-3" /> Aguardando Credenciais
          </Badge>
        )
      case 'fila':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300 gap-1 text-[10px]">
            <Clock className="h-3 w-3" /> Na Fila
          </Badge>
        )
      case 'falhou':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 gap-1 text-[10px]">
            <XCircle className="h-3 w-3" /> Falhou
          </Badge>
        )
      case 'cancelado':
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-300 gap-1 text-[10px]">
            Cancelado
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTipoIcon = (tipo: WhatsAppEnvioTipo) => {
    switch (tipo) {
      case 'aviso':
        return <Bell className="h-3.5 w-3.5 text-amber-500" />
      case 'guia':
        return <DollarSign className="h-3.5 w-3.5 text-blue-500" />
      case 'previa':
        return <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
      case 'demonstrativo':
        return <FileText className="h-3.5 w-3.5 text-emerald-500" />
      case 'documento':
        return <FolderOpen className="h-3.5 w-3.5 text-purple-500" />
      case 'cobranca':
        return <CreditCard className="h-3.5 w-3.5 text-teal-600" />
      case 'teste':
        return <Send className="h-3.5 w-3.5 text-sky-500" />
      default:
        return <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
    }
  }

  return (
    <div className="space-y-6 pt-2">
      {/* Banner Informativo & Modo de Operação */}
      <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-transparent p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0FA3A3] text-white shadow-sm">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#1A2333]">Envio Ativo por WhatsApp</h3>
              <Badge className="bg-[#0FA3A3] text-white text-[10px] font-semibold">
                Hiperautomação 24/7 & Supervisão
              </Badge>
            </div>
            <p className="text-xs text-[#475569] mt-0.5 max-w-2xl leading-relaxed">
              Dispare ativamente e configure a automação de <strong>avisos de obrigações</strong>,{' '}
              <strong>guias de tributos (DAS/DARF)</strong>, <strong>prévias de apuração</strong>,{' '}
              <strong>demonstrativos</strong> e <strong>documentos</strong> para o WhatsApp do
              cliente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!statusEvo.configurado ? (
            <div className="flex flex-col items-end gap-1">
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-300 text-[11px] py-1 px-3 font-medium flex items-center gap-1.5 shadow-2xs"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                Modo Supervisão (Aguardando Credenciais)
              </Badge>
              <a
                href="/integracoes"
                className="text-[11px] text-[#0FA3A3] hover:underline flex items-center gap-1 font-medium"
              >
                Configurar em Integrações → NFS-e & WhatsApp
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : (
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[11px] py-1 px-3 font-medium flex items-center gap-1.5 shadow-2xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Evolution API Ativa ({statusEvo.instance})
            </Badge>
          )}
        </div>
      </div>

      {/* Seletor de Empresa e Painel de Configurações */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUNA ESQUERDA: AUTORIZAÇÕES DA EMPRESA (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-[#1A2333]">
                    Configurar Empresa
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Defina o telefone e quais itens podem ser despachados
                  </CardDescription>
                </div>
                <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                  <SelectTrigger className="w-48 h-8 text-xs bg-white">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.nome_fantasia || emp.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {loadingConfig ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Carregando preferências da empresa...
                </div>
              ) : !selectedEmpresa ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Nenhuma empresa selecionada.
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>WhatsApp Vinculado para Envio Ativo</span>
                      <Phone className="h-3.5 w-3.5 text-[#0FA3A3]" />
                    </Label>
                    <Input
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="(41) 99999-9999"
                      disabled={!canManage}
                      className="h-9 text-xs font-mono rounded-xl border-slate-200"
                    />
                    <p className="text-[11px] text-slate-500">
                      Número comercial ou financeiro da empresa que receberá as mensagens.
                    </p>
                  </div>

                  {/* Switches de Autorização */}
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Itens Autorizados para Envio Ativo
                    </span>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                          <Bell className="h-3.5 w-3.5 text-amber-500" />
                          Avisos de Obrigações a Vencer
                        </Label>
                        <p className="text-[10px] text-slate-500">
                          ELLIZA 24/7 notifica automaticamente até 3 dias antes do vencimento
                        </p>
                      </div>
                      <Switch
                        checked={permiteAvisos}
                        onCheckedChange={setPermiteAvisos}
                        disabled={!canManage}
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                          <DollarSign className="h-3.5 w-3.5 text-blue-500" />
                          Guias de Pagamento (DAS, DARF, INSS)
                        </Label>
                        <p className="text-[10px] text-slate-500">
                          Disponibiliza valor, código de barras e link seguro de download
                        </p>
                      </div>
                      <Switch
                        checked={permiteGuias}
                        onCheckedChange={setPermiteGuias}
                        disabled={!canManage}
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                          <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
                          Prévias de Apuração Fiscal
                        </Label>
                        <p className="text-[10px] text-slate-500">
                          Estimativas de impostos do Simples, Lucro Presumido ou Real
                        </p>
                      </div>
                      <Switch
                        checked={permitePrevias}
                        onCheckedChange={setPermitePrevias}
                        disabled={!canManage}
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                          <FileText className="h-3.5 w-3.5 text-emerald-500" />
                          Demonstrativos (DRE, Balancete, Holerites)
                        </Label>
                        <p className="text-[10px] text-slate-500">
                          Comunica fechamento contábil e disponibilidade para consulta
                        </p>
                      </div>
                      <Switch
                        checked={permiteDemonstrativos}
                        onCheckedChange={setPermiteDemonstrativos}
                        disabled={!canManage}
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                          <FolderOpen className="h-3.5 w-3.5 text-purple-500" />
                          Documentos e Arquivos GED
                        </Label>
                        <p className="text-[10px] text-slate-500">
                          Avisa sobre contratos, procurações ou certidões anexadas
                        </p>
                      </div>
                      <Switch
                        checked={permiteDocumentos}
                        onCheckedChange={setPermiteDocumentos}
                        disabled={!canManage}
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                          <CreditCard className="h-3.5 w-3.5 text-teal-600" />
                          Cobranças & Faturas (PIX / Boleto)
                        </Label>
                        <p className="text-[10px] text-slate-500">
                          Envio automático e manual de cobranças com chave PIX e copia-e-cola
                        </p>
                      </div>
                      <Switch
                        checked={permiteCobrancas}
                        onCheckedChange={setPermiteCobrancas}
                        disabled={!canManage}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      Observações de Envio
                    </Label>
                    <Textarea
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder="Ex: Enviar preferencialmente no período matutino para o setor financeiro."
                      disabled={!canManage}
                      className="text-xs h-16 rounded-xl border-slate-200 resize-none"
                    />
                  </div>

                  {canManage && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <Button
                        onClick={() => handleAbrirModalDisparo('aviso')}
                        variant="outline"
                        className="text-xs font-semibold gap-1.5 h-9 rounded-xl border-[#0FA3A3] text-[#0FA3A3] hover:bg-teal-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Disparar Envio Agora
                      </Button>

                      <Button
                        onClick={handleSalvarPreferencias}
                        disabled={salvandoConfig}
                        className="bg-[#0FA3A3] hover:bg-[#0c8787] text-white text-xs font-semibold gap-1.5 h-9 rounded-xl"
                      >
                        {salvandoConfig ? (
                          'Salvando...'
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5" /> Salvar Autorizações
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA: HISTÓRICO DE AUDITORIA DE ENVIOS (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
            <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
                    <History className="h-4 w-4 text-[#0FA3A3]" />
                    Histórico & Auditoria de Envios Ativos
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Rastreabilidade completa de cada aviso disparado para esta empresa
                  </CardDescription>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => carregarDadosEmpresa(selectedEmpresaId)}
                  className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
                  title="Atualizar histórico"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loadingEnvios ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Carregando histórico de envios...
                </div>
              ) : envios.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <Send className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-medium text-slate-600">
                    Nenhum envio registrado para esta empresa.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Quando a ELLIZA ou a equipe despachar avisos, guias ou relatórios, a trilha de
                    auditoria será exibida aqui com status e data.
                  </p>
                  {canManage && (
                    <Button
                      onClick={() => handleAbrirModalDisparo('aviso')}
                      variant="outline"
                      size="sm"
                      className="text-xs font-semibold gap-1.5 mt-2 rounded-xl border-[#0FA3A3] text-[#0FA3A3]"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Disparar Primeiro Envio
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
                  {envios.map((env) => (
                    <div
                      key={env.id}
                      className="p-4 hover:bg-slate-50/70 transition-colors space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 font-bold text-xs text-slate-800 capitalize">
                            {getTipoIcon(env.tipo)}
                            {env.tipo}
                          </div>
                          <Badge variant="outline" className="text-[10px] font-mono text-slate-600">
                            {env.destinatario}
                          </Badge>
                          <Badge className="bg-slate-100 text-slate-600 text-[9px] px-1.5 py-0 border-slate-200">
                            Origem: {env.origem}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          {getStatusBadge(env.status)}
                          <span className="text-[10px] text-slate-400">
                            {formatDateTimePtBr(env.created)}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
                        {env.mensagem}
                      </div>

                      {env.erro && (
                        <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-lg flex items-start gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500 mt-0.5" />
                          <span>{env.erro}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Disparo Sob Demanda */}
      <Dialog open={modalDisparoOpen} onOpenChange={setModalDisparoOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-[#0FA3A3]" />
              Disparar Envio Ativo por WhatsApp
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selecione o tipo de conteúdo e revise a mensagem antes do despacho para a empresa{' '}
              <strong>{selectedEmpresa?.nome_fantasia || selectedEmpresa?.razao_social}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDispararEnvio} className="space-y-3.5 py-1 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Tipo do Conteúdo</Label>
                <Select
                  value={tipoDisparo}
                  onValueChange={(val: WhatsAppEnvioTipo) => {
                    setTipoDisparo(val)
                    atualizarMensagemPorTipo(val, '')
                  }}
                >
                  <SelectTrigger className="h-9 mt-1 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aviso" className="text-xs">
                      Aviso de Obrigação
                    </SelectItem>
                    <SelectItem value="guia" className="text-xs">
                      Guia de Pagamento (DAS/DARF)
                    </SelectItem>
                    <SelectItem value="previa" className="text-xs">
                      Prévia de Apuração
                    </SelectItem>
                    <SelectItem value="demonstrativo" className="text-xs">
                      Demonstrativo Contábil
                    </SelectItem>
                    <SelectItem value="documento" className="text-xs">
                      Documento / Arquivo GED
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Destinatário (WhatsApp)</Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(41) 99999-9999"
                  required
                  className="h-9 mt-1 text-xs font-mono rounded-xl"
                />
              </div>
            </div>

            {/* Seleção do Item de Referência Real quando aplicável */}
            {tipoDisparo === 'aviso' && (
              <div>
                <Label className="text-xs font-semibold">Obrigação Vinculada</Label>
                <Select
                  value={referenciaItem}
                  onValueChange={(id) => atualizarMensagemPorTipo('aviso', id)}
                >
                  <SelectTrigger className="h-9 mt-1 text-xs rounded-xl">
                    <SelectValue placeholder="Selecione uma obrigação" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {obrigacoes.length === 0 ? (
                      <SelectItem value="none" disabled className="text-xs">
                        Nenhuma obrigação cadastrada (usará modelo padrão)
                      </SelectItem>
                    ) : (
                      obrigacoes.map((o) => (
                        <SelectItem key={o.id} value={o.id} className="text-xs">
                          {o.tipo} - Comp. {o.competencia} - Venc. {o.vencimento?.slice(0, 10)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tipoDisparo === 'guia' && (
              <div>
                <Label className="text-xs font-semibold">Guia de Pagamento Vinculada</Label>
                <Select
                  value={referenciaItem}
                  onValueChange={(id) => atualizarMensagemPorTipo('guia', id)}
                >
                  <SelectTrigger className="h-9 mt-1 text-xs rounded-xl">
                    <SelectValue placeholder="Selecione uma guia" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {guias.length === 0 ? (
                      <SelectItem value="none" disabled className="text-xs">
                        Nenhuma guia cadastrada (usará modelo padrão)
                      </SelectItem>
                    ) : (
                      guias.map((g) => (
                        <SelectItem key={g.id} value={g.id} className="text-xs">
                          {g.tipo_guia.toUpperCase()} - {g.periodo_apuracao || 'Atual'} - R${' '}
                          {(g.valor_total || 0).toFixed(2)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tipoDisparo === 'demonstrativo' && (
              <div>
                <Label className="text-xs font-semibold">Demonstrativo Vinculado</Label>
                <Select
                  value={referenciaItem}
                  onValueChange={(id) => atualizarMensagemPorTipo('demonstrativo', id)}
                >
                  <SelectTrigger className="h-9 mt-1 text-xs rounded-xl">
                    <SelectValue placeholder="Selecione um demonstrativo" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {demonstrativos.length === 0 ? (
                      <SelectItem value="none" disabled className="text-xs">
                        Nenhum demonstrativo cadastrado (usará modelo padrão)
                      </SelectItem>
                    ) : (
                      demonstrativos.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="text-xs">
                          {d.tipo.toUpperCase()} - Comp. {d.competencia}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tipoDisparo === 'documento' && (
              <div>
                <Label className="text-xs font-semibold">Documento GED Vinculado</Label>
                <Select
                  value={referenciaItem}
                  onValueChange={(id) => atualizarMensagemPorTipo('documento', id)}
                >
                  <SelectTrigger className="h-9 mt-1 text-xs rounded-xl">
                    <SelectValue placeholder="Selecione um documento" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {documentos.length === 0 ? (
                      <SelectItem value="none" disabled className="text-xs">
                        Nenhum documento anexado (usará modelo padrão)
                      </SelectItem>
                    ) : (
                      documentos.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id} className="text-xs truncate">
                          {doc.nome_arquivo} ({doc.tipo})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold">Pré-visualização da Mensagem</Label>
              <Textarea
                value={mensagemPersonalizada}
                onChange={(e) => setMensagemPersonalizada(e.target.value)}
                rows={7}
                required
                className="mt-1 text-xs font-mono rounded-xl border-slate-200 leading-relaxed"
              />
            </div>

            {!statusEvo.configurado && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-800 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <strong>Atenção (Modo Supervisão):</strong> Como a Evolution API não possui
                  credenciais ativas no tenant, este envio será registrado na fila com status{' '}
                  <em>"aguardando credenciais"</em> para conferência e auditoria.
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalDisparoOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={disparando || !telefone.trim()}
                className="rounded-xl text-xs bg-[#0FA3A3] text-white hover:bg-[#0C8585] gap-1.5"
              >
                {disparando ? (
                  'Disparando...'
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Confirmar e Despachar
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  Edit,
  Power,
  FileText,
  GitPullRequest,
  Calculator,
  Layers,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Calendar,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { documentosService } from '@/services/documentos'
import { workflowService } from '@/services/workflows'
import { fiscalService } from '@/services/fiscal'
import { obrigacoesService } from '@/services/obrigacoes'
import { useRealtime } from '@/hooks/use-realtime'
import { certificadosService, type CertificadoSaudeInfo } from '@/services/certificados'
import { certidoesService, ecacService } from '@/services/regularidade'
import { EmpresaRegularidadeSection } from '@/components/EmpresaRegularidadeSection'
import { EmpresaNfeRecebidasTab } from '@/components/EmpresaNfeRecebidasTab'
import { EmpresaAberturaTab } from '@/components/EmpresaAberturaTab'
import { ModalExclusaoEmpresa } from '@/components/ModalExclusaoEmpresa'
import { ProcessoMigracaoDetalheCard } from '@/components/ProcessoMigracaoDetalheCard'
import { ModalNovoProcessoMigracao } from '@/components/ModalNovoProcessoMigracao'
import { ModalSalvarCertificado } from '@/components/ModalSalvarCertificado'
import { empresasMigracoesOnboardingService } from '@/services/empresasMigracoesOnboardingService'
import type { EmpresaMigracaoOnboardingRecord, MigracaoTipo, ObrigacaoRecord } from '@/types'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  KeyRound,
  Download,
  AlertCircle,
  Trash2,
  Archive,
  FileCheck2,
  Inbox,
  Sparkles,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { maskCnpj, formatDatePtBr } from '@/lib/formatters'
import type {
  Empresa,
  Documento,
  Workflow,
  FiscalRecord,
  CertificadoDigitalRecord,
  CertidaoRecord,
  EcacComunicacaoRecord,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

export default function EmpresaDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const { user, tenant, member, isGestorEmpresas } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const podeExcluir = Boolean(
    isGestorEmpresas ||
    member?.perfil === 'administrador' ||
    member?.perfil === 'contador' ||
    (user?.role as string) === 'administrador' ||
    (user?.role as string) === 'contador' ||
    (user?.perfil as string) === 'administrador' ||
    (user?.perfil as string) === 'contador',
  )

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [showExcluirModal, setShowExcluirModal] = useState(false)
  const [showCertificadoModal, setShowCertificadoModal] = useState(false)
  const [certificado, setCertificado] = useState<CertificadoDigitalRecord | null>(null)
  const [certidoes, setCertidoes] = useState<CertidaoRecord[]>([])
  const [ecacComunicacoes, setEcacComunicacoes] = useState<EcacComunicacaoRecord[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [fiscalList, setFiscalList] = useState<FiscalRecord[]>([])
  const [obrigacoesList, setObrigacoesList] = useState<ObrigacaoRecord[]>([])
  const [processoMigracaoAtivo, setProcessoMigracaoAtivo] =
    useState<EmpresaMigracaoOnboardingRecord | null>(null)
  const [modalNovoMigracaoOpen, setModalNovoMigracaoOpen] = useState(false)
  const [tipoNovoMigracao, setTipoNovoMigracao] = useState<MigracaoTipo>('entrada')
  const [loading, setLoading] = useState(true)

  // Confirmation modal to Encerrar
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closing, setClosing] = useState(false)

  const loadData = useCallback(async () => {
    if (!id || !tenant?.id) return
    try {
      setLoading(true)
      const emp = await empresasService.getById(id)
      setEmpresa(emp)

      // Fetch related data
      // Fetch related data in parallel with resilient error handling per resource
      const [
        docsRes,
        wfsRes,
        fiscRes,
        certRes,
        certsListRes,
        ecacListRes,
        procMigracaoRes,
        obListRes,
      ] = await Promise.allSettled([
        documentosService.list(tenant.id, `empresa_id = "${id}"`),
        workflowService.list(tenant.id, `empresa_id = "${id}"`),
        fiscalService.list(tenant.id, `empresa_id = "${id}"`),
        certificadosService.getByEmpresa(id),
        certidoesService.listByEmpresa(id),
        ecacService.listByEmpresa(id),
        empresasMigracoesOnboardingService.getAtivoByEmpresa(tenant.id, id),
        obrigacoesService.list(tenant.id, `empresa_id = "${id}"`),
      ])

      setDocumentos(docsRes.status === 'fulfilled' ? docsRes.value : [])
      setWorkflows(wfsRes.status === 'fulfilled' ? wfsRes.value : [])
      setFiscalList(fiscRes.status === 'fulfilled' ? fiscRes.value : [])
      setCertificado(certRes.status === 'fulfilled' ? certRes.value : null)
      setCertidoes(certsListRes.status === 'fulfilled' ? certsListRes.value : [])
      setEcacComunicacoes(ecacListRes.status === 'fulfilled' ? ecacListRes.value : [])
      setProcessoMigracaoAtivo(
        procMigracaoRes.status === 'fulfilled' ? procMigracaoRes.value : null,
      )
      setObrigacoesList(obListRes.status === 'fulfilled' ? obListRes.value : [])

      if (fiscRes.status === 'rejected' && obListRes.status === 'rejected') {
        console.warn('Falha ao buscar obrigações e declarações fiscais:', fiscRes.reason)
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar dados',
          description: 'Não foi possível buscar as obrigações fiscais.',
        })
      }
    } catch (err) {
      console.error('Error loading empresa details:', err)
      toast({
        variant: 'destructive',
        title: 'Empresa não encontrada',
        description: 'Não foi possível carregar os detalhes da empresa.',
      })
      navigate('/empresas')
    } finally {
      setLoading(false)
    }
  }, [id, tenant?.id, navigate, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime updates para a tela de detalhes da empresa
  useRealtime('obrigacoes', () => loadData())
  useRealtime('fiscal', () => loadData())
  useRealtime('documentos', () => loadData())
  useRealtime('workflows', () => loadData())
  useRealtime('guias_pagamentos', () => loadData())

  const handleMarcarObrigacaoEntregue = async (obId: string) => {
    try {
      await obrigacoesService.marcarComoEntregue(obId, tenant?.id)
      toast({
        title: 'Obrigação transmitida!',
        description: 'Status atualizado com sucesso para entregue.',
      })
      loadData()
    } catch (err) {
      console.error('Erro ao marcar obrigação entregue na empresa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: 'Não foi possível marcar a obrigação como transmitida.',
      })
    }
  }

  const handleEncerrar = async () => {
    if (!empresa) return
    setClosing(true)
    try {
      await empresasService.update(empresa.id, { status: 'encerrado' })
      toast({
        title: 'Empresa encerrada',
        description: `Status atualizado para encerrado.`,
      })
      setShowCloseModal(false)
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao encerrar',
        description: 'Não foi possível alterar o status.',
      })
    } finally {
      setClosing(false)
    }
  }

  if (loading || !empresa) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0FA3A3]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#E2E8F0] pb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/empresas')}
            className="h-10 w-10 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
                {empresa.nome_fantasia || empresa.razao_social}
              </h2>
              <Badge
                className={
                  empresa.status === 'ativo'
                    ? 'bg-[#DCFCE7] text-[#166534]'
                    : empresa.status === 'encerrado'
                      ? 'bg-[#FEE2E2] text-[#991B1B]'
                      : 'bg-[#FEF3C7] text-[#92400E]'
                }
              >
                {empresa.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-[#64748B]">
              Razão Social:{' '}
              <span className="font-semibold text-[#1A2333]">{empresa.razao_social}</span> • CNPJ:{' '}
              <span className="font-mono">{maskCnpj(empresa.cnpj)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate(`/empresas/${empresa.id}/editar`)}
            variant="outline"
            className="h-9 gap-2 rounded-xl text-xs font-semibold"
          >
            <Edit className="h-3.5 w-3.5 text-[#3B82F6]" />
            <span>Editar Cadastro</span>
          </Button>

          {empresa.status !== 'encerrado' && (
            <Button
              onClick={() => setShowCloseModal(true)}
              variant="outline"
              className="h-9 gap-2 rounded-xl text-xs text-[#F59E0B] hover:bg-amber-50 hover:text-amber-700"
            >
              <Power className="h-3.5 w-3.5" />
              <span>Encerrar</span>
            </Button>
          )}

          {podeExcluir && (
            <Button
              onClick={() => setShowExcluirModal(true)}
              variant="outline"
              className="h-9 gap-2 rounded-xl text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-600" />
              <span>Excluir (Backup 24h)</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Layout: Visão Geral, Certificado Digital, Documentos, Workflows, Fiscal, Integrações */}
      <Tabs
        value={tabParam || 'visao_geral'}
        onValueChange={(val) => {
          if (val === 'visao_geral') {
            searchParams.delete('tab')
            setSearchParams(searchParams, { replace: true })
          } else {
            setSearchParams({ tab: val }, { replace: true })
          }
        }}
        className="space-y-6"
      >
        <TabsList className="bg-slate-100 p-1.5 rounded-xl h-auto w-full justify-start flex-wrap gap-1">
          <TabsTrigger value="visao_geral" className="rounded-lg text-xs font-semibold gap-2">
            <Building2 className="h-4 w-4" />
            <span>Visão Geral</span>
          </TabsTrigger>
          {/* Aba Migração & Onboarding da Empresa */}
          {member?.perfil !== 'cliente' && (
            <TabsTrigger
              value="migracao_onboarding"
              className="rounded-lg text-xs font-semibold gap-2 text-teal-900 data-[state=active]:bg-teal-50 data-[state=active]:text-teal-950"
            >
              <Layers className="h-4 w-4 text-[#0FA3A3]" />
              <span>Migração & Onboarding</span>
              {processoMigracaoAtivo && (
                <Badge
                  variant="outline"
                  className={
                    processoMigracaoAtivo.tipo === 'entrada'
                      ? 'border-teal-300 bg-teal-50 text-teal-800 text-[9px] font-bold px-1.5 py-0'
                      : 'border-amber-300 bg-amber-50 text-amber-800 text-[9px] font-bold px-1.5 py-0'
                  }
                >
                  {processoMigracaoAtivo.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {/* Aba Abertura de Empresa em destaque: visível apenas para equipe interna (oculta para perfil cliente) */}
          {member?.perfil !== 'cliente' && (
            <TabsTrigger
              value="abertura"
              className="rounded-lg text-xs font-semibold gap-2 text-teal-700 data-[state=active]:bg-teal-50 data-[state=active]:text-teal-900"
            >
              <Sparkles className="h-4 w-4 text-[#0FA3A3]" />
              <span>Abertura de Empresa</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="certificado" className="rounded-lg text-xs font-semibold gap-2">
            <KeyRound className="h-4 w-4" />
            <span>
              Certificado Digital{' '}
              {certificado && (
                <span className="ml-1 inline-block h-2 w-2 rounded-full bg-teal-500" />
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="regularidade" className="rounded-lg text-xs font-semibold gap-2">
            <ShieldCheck className="h-4 w-4 text-[#0FA3A3]" />
            <span>
              Regularidade & CND / E-CAC
              {(certidoes.some((c) => {
                const s = certidoesService.calcularSaude(c)
                return s.saude === 'vencida' || s.saude === 'proximo_vencimento'
              }) ||
                ecacComunicacoes.some((e) => !e.lida)) && (
                <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="documentos" className="rounded-lg text-xs font-semibold gap-2">
            <FileText className="h-4 w-4" />
            <span>Documentos ({documentos.length})</span>
          </TabsTrigger>
          <TabsTrigger value="workflows" className="rounded-lg text-xs font-semibold gap-2">
            <GitPullRequest className="h-4 w-4" />
            <span>Workflows ({workflows.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="nfe_recebidas"
            className="rounded-lg text-xs font-semibold gap-2 text-[#0FA3A3] data-[state=active]:text-[#0FA3A3]"
          >
            <Layers className="h-4 w-4" />
            <span>Busca NF-e (Destinatário)</span>
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="rounded-lg text-xs font-semibold gap-2">
            <Calculator className="h-4 w-4" />
            <span>Fiscal ({fiscalList.length + obrigacoesList.length})</span>
          </TabsTrigger>
          <TabsTrigger value="integracoes" className="rounded-lg text-xs font-semibold gap-2">
            <Layers className="h-4 w-4" />
            <span>Integrações</span>
          </TabsTrigger>
        </TabsList>
        {/* Tab 1: Visão Geral */}
        <TabsContent value="visao_geral" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Dados Cadastrais Card */}
            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-[#1A2333]">
                  Enquadramento Fiscal
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div>
                  <span className="text-[#64748B]">Regime Tributário:</span>
                  <p className="font-semibold text-[#1A2333] capitalize">
                    {empresa.regime_tributario?.replace('_', ' ') || 'Não informado'}
                  </p>
                </div>
                <div>
                  <span className="text-[#64748B]">Porte Empresarial:</span>
                  <p className="font-semibold text-[#1A2333] uppercase">{empresa.porte || 'ME'}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">Inscrição Estadual (IE):</span>
                  <p className="font-semibold text-[#1A2333]">
                    {empresa.inscricao_estadual || 'Isento'}
                  </p>
                </div>
                <div>
                  <span className="text-[#64748B]">Inscrição Municipal (IM):</span>
                  <p className="font-semibold text-[#1A2333]">
                    {empresa.inscricao_municipal || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[#64748B]">Data de Abertura:</span>
                  <p className="font-semibold text-[#1A2333]">
                    {formatDatePtBr(empresa.data_abertura)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Endereço Card */}
            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-[#1A2333]">
                  Localização / Endereço
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-[#0FA3A3] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#1A2333]">
                      {empresa.logradouro || 'Logradouro não informado'}
                      {empresa.numero ? `, ${empresa.numero}` : ''}
                    </p>
                    {empresa.complemento && <p className="text-[#64748B]">{empresa.complemento}</p>}
                    <p className="text-[#64748B]">
                      {empresa.bairro || ''}{' '}
                      {empresa.cidade ? `— ${empresa.cidade}/${empresa.uf}` : ''}
                    </p>
                    <p className="font-mono text-[11px] text-[#94A3B8]">
                      CEP: {empresa.cep || '—'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contatos Card */}
            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-[#1A2333]">
                  Canais de Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#0FA3A3] shrink-0" />
                  <span className="text-[#1A2333] truncate">{empresa.email || 'Sem e-mail'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[#0FA3A3] shrink-0" />
                  <span className="text-[#1A2333]">{empresa.telefone || 'Sem telefone'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-[#0FA3A3] shrink-0" />
                  <span className="text-[#1A2333] truncate">{empresa.site || 'Sem site'}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Observações */}
          {empresa.observacoes && (
            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Observações Operacionais
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-[#1A2333] whitespace-pre-line">
                {empresa.observacoes}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Regularidade (Certidões & Caixa Postal E-CAC) */}
        <TabsContent value="regularidade" className="space-y-6">
          {tenant?.id && (
            <EmpresaRegularidadeSection
              empresaId={empresa.id}
              tenantId={tenant.id}
              canEdit={true}
              certidoes={certidoes}
              comunicacoesEcac={ecacComunicacoes}
              temCertificadoA1={Boolean(certificado && certificado.tipo === 'a1')}
              empresa={empresa}
              onRefresh={async () => {
                const [certsList, ecacList] = await Promise.all([
                  certidoesService.listByEmpresa(empresa.id),
                  ecacService.listByEmpresa(empresa.id),
                ])
                setCertidoes(certsList)
                setEcacComunicacoes(ecacList)
              }}
            />
          )}
        </TabsContent>

        {/* Tab 2: Certificado Digital */}
        <TabsContent value="certificado" className="space-y-6">
          {certificado ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="rounded-2xl border-[#E2E8F0] shadow-xs md:col-span-2">
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-[#1A2333]">
                      Certificado Digital e-CNPJ ({certificado.tipo.toUpperCase()})
                    </CardTitle>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Utilizado para assinatura de declarações e consultas fiscais da empresa
                    </p>
                  </div>
                  {(() => {
                    const saude = certificadosService.calcularSaude(certificado)
                    if (saude.saude === 'valido') {
                      return (
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold gap-1.5 py-1 px-3">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Certificado OK ({saude.diasRestantes}d)</span>
                        </Badge>
                      )
                    }
                    if (saude.saude === 'proximo_vencimento') {
                      return (
                        <Badge className="bg-amber-50 text-amber-800 border border-amber-300 text-xs font-semibold gap-1.5 py-1 px-3 animate-pulse">
                          <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                          <span>Vence em {saude.diasRestantes} dias</span>
                        </Badge>
                      )
                    }
                    return (
                      <Badge className="bg-red-50 text-red-700 border border-red-200 text-xs font-semibold gap-1.5 py-1 px-3">
                        <ShieldX className="h-3.5 w-3.5 text-red-600" />
                        <span>Expirado</span>
                      </Badge>
                    )
                  })()}
                </CardHeader>
                <CardContent className="pt-4 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[#64748B]">Titular / e-CNPJ:</span>
                      <p className="font-semibold text-[#1A2333] mt-0.5">{certificado.titular}</p>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Autoridade Certificadora (Emissor):</span>
                      <p className="font-semibold text-[#1A2333] mt-0.5">{certificado.emissor}</p>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Data de Validade:</span>
                      <p className="font-semibold text-[#1A2333] mt-0.5">
                        {formatDatePtBr(certificado.validade)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Número de Série:</span>
                      <p className="font-mono text-[#1A2333] mt-0.5">
                        {certificado.numero_serie || 'Não informado'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Tipo / Formato:</span>
                      <p className="font-semibold text-[#1A2333] uppercase mt-0.5">
                        {certificado.tipo} (
                        {certificado.tipo === 'a1'
                          ? 'Arquivo .pfx em nuvem'
                          : 'Smartcard / Token físico'}
                        )
                      </p>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Status de Registro:</span>
                      <p className="font-semibold text-[#1A2333] capitalize mt-0.5">
                        {certificado.status}
                      </p>
                    </div>
                  </div>

                  {certificado.observacoes && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[#64748B]">Observações:</span>
                      <p className="text-[#1A2333] mt-0.5">{certificado.observacoes}</p>
                    </div>
                  )}

                  {certificado.arquivo_pfx && (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-[#0FA3A3]" />
                        <span className="font-mono text-xs text-[#1A2333]">
                          {certificado.arquivo_pfx}
                        </span>
                      </div>
                      <a
                        href={pb.files.getURL(certificado, certificado.arquivo_pfx)}
                        download
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0FA3A3] hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Baixar Arquivo .pfx</span>
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Card de Boas Práticas e Ação de Edição */}
              <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-[#1A2333]">
                    Segurança & Gestão
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 text-xs text-[#64748B]">
                  <p>
                    A plataforma utiliza o certificado digital para verificação de pendências no
                    e-CAC, emissão de NFS-e e validação de declarações no SPED e DCTFWeb.
                  </p>
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-900 text-[11px] leading-relaxed">
                    <b>Aviso de Privacidade:</b> A senha e os arquivos de chave privada A1 são de
                    uso restrito à equipe técnica contábil autorizada.
                  </div>
                  <Button
                    onClick={() => setShowCertificadoModal(true)}
                    disabled={member?.perfil === 'cliente'}
                    className="w-full gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold h-9 disabled:opacity-50"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>Atualizar / Substituir Certificado</span>
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs p-8 text-center">
              <div className="max-w-md mx-auto space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-[#1A2333]">
                  Nenhum Certificado Digital Cadastrado
                </h3>
                <p className="text-xs text-[#64748B]">
                  Esta empresa ainda não possui certificado digital A1 ou A3 cadastrado. Sem o
                  certificado, algumas obrigações fiscais (como SPED, EFD e DCTFWeb) não poderão ser
                  transmitidas diretamente pelo sistema.
                </p>
                <Button
                  onClick={() => setShowCertificadoModal(true)}
                  disabled={member?.perfil === 'cliente'}
                  className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold h-9 disabled:opacity-50"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Cadastrar Certificado Agora</span>
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Tab 3: Documentos */}
        <TabsContent value="documentos">
          <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
            <CardContent className="p-4">
              {documentos.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#94A3B8]">
                  Nenhum documento arquivado para esta empresa.
                </div>
              ) : (
                <div className="space-y-2">
                  {documentos.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-[#0FA3A3]" />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-semibold text-[#1A2333]">
                              {doc.nome_arquivo}
                            </p>
                            {doc.origem_documento === 'busca_sefaz' && (
                              <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-semibold py-0 h-5">
                                Busca SEFAZ
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-[#64748B] capitalize">
                            Tipo: {doc.tipo.replace('_', ' ')} • Enviado em{' '}
                            {formatDatePtBr(doc.created)}
                          </p>
                          {doc.chave_acesso_nfe && (
                            <p className="text-[10px] font-mono text-slate-400 truncate max-w-md">
                              Chave: {doc.chave_acesso_nfe}
                            </p>
                          )}
                          {doc.observacoes && doc.origem_documento === 'busca_sefaz' && (
                            <p className="text-[10px] text-teal-800 line-clamp-1 italic">
                              {doc.observacoes}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge
                        className={
                          doc.status === 'processado'
                            ? 'bg-[#DCFCE7] text-[#166534]'
                            : 'bg-[#FEF3C7] text-[#92400E]'
                        }
                      >
                        {doc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Workflows */}
        <TabsContent value="workflows">
          <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
            <CardContent className="p-4">
              {workflows.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#94A3B8]">
                  Nenhum workflow ativo ou finalizado para esta empresa.
                </div>
              ) : (
                <div className="space-y-2">
                  {workflows.map((wf) => (
                    <div
                      key={wf.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <GitPullRequest className="h-5 w-5 text-[#F59E0B]" />
                        <div>
                          <p className="text-xs font-semibold text-[#1A2333]">{wf.titulo}</p>
                          <p className="text-[11px] text-[#64748B]">
                            Prazo: {formatDatePtBr(wf.prazo)} • Prioridade: {wf.prioridade}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={
                          wf.status === 'concluido'
                            ? 'bg-[#DCFCE7] text-[#166534]'
                            : wf.status === 'em_andamento'
                              ? 'bg-[#DBEAFE] text-[#1E40AF]'
                              : 'bg-[#FEF3C7] text-[#92400E]'
                        }
                      >
                        {wf.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Busca NF-e (Destinatário SEFAZ DFe) */}
        <TabsContent value="nfe_recebidas" className="space-y-6">
          <EmpresaNfeRecebidasTab
            empresa={empresa}
            canEdit={!user?.role || user.role === 'administrador' || user.role === 'contador'}
            onSyncCompleted={async () => {
              if (tenant?.id) {
                const docsList = await documentosService.listByEmpresa(empresa.id)
                setDocumentos(docsList)
              }
            }}
          />
        </TabsContent>

        {/* Tab: Migração & Onboarding da Empresa */}
        {member?.perfil !== 'cliente' && tenant?.id && empresa && (
          <TabsContent value="migracao_onboarding" className="space-y-6">
            {processoMigracaoAtivo ? (
              <ProcessoMigracaoDetalheCard
                processo={processoMigracaoAtivo}
                canEdit={
                  member?.perfil === 'administrador' ||
                  member?.perfil === 'contador' ||
                  isGestorEmpresas ||
                  (user?.role as string) === 'administrador' ||
                  (user?.role as string) === 'contador'
                }
                usuarioId={user?.id || ''}
                usuarioNome={user?.nome || user?.email || 'Contador'}
                tenantId={tenant.id}
                onAtualizado={(atualizado) => {
                  setProcessoMigracaoAtivo(atualizado)
                }}
              />
            ) : (
              <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs p-10 text-center bg-white">
                <div className="max-w-lg mx-auto space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-2xl bg-teal-50 text-[#0FA3A3] flex items-center justify-center">
                    <Layers className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-[#1A2333]">
                      Nenhum processo de migração ativo para esta empresa
                    </h3>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Se esta empresa acabou de chegar de outro contador ou está sendo transferida
                      para um novo escritório, inicie o checklist de acolhimento (Onboarding) ou o
                      handover de saída.
                    </p>
                  </div>
                  {(member?.perfil === 'administrador' ||
                    member?.perfil === 'contador' ||
                    isGestorEmpresas) && (
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <Button
                        onClick={() => {
                          setTipoNovoMigracao('entrada')
                          setModalNovoMigracaoOpen(true)
                        }}
                        className="text-xs bg-[#0FA3A3] hover:bg-[#0C8585] text-white rounded-xl gap-1.5"
                      >
                        <span>+ Iniciar Migração de Entrada (Onboarding)</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setTipoNovoMigracao('saida')
                          setModalNovoMigracaoOpen(true)
                        }}
                        className="text-xs rounded-xl border-amber-300 text-amber-800 hover:bg-amber-50 gap-1.5"
                      >
                        <span>+ Iniciar Migração de Saída (Handover)</span>
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Tab: Abertura de Empresa */}
        {member?.perfil !== 'cliente' && tenant?.id && (
          <TabsContent value="abertura" className="space-y-6">
            <EmpresaAberturaTab
              empresa={empresa}
              tenantId={tenant.id}
              usuarioId={user?.id || ''}
              userRole={member?.perfil}
              canEdit={
                member?.perfil === 'administrador' ||
                member?.perfil === 'contador' ||
                isGestorEmpresas ||
                (user?.role as string) === 'administrador' ||
                (user?.role as string) === 'contador'
              }
              onEmpresaAtualizada={() => {
                loadData()
              }}
            />
          </TabsContent>
        )}

        {/* Tab 4: Fiscal & Obrigações */}
        <TabsContent value="fiscal" className="space-y-6">
          {/* Seção 1: Obrigações Fiscais e Vencimentos (Collection obrigacoes) */}
          <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#0FA3A3]" />
                  <span>Calendário de Obrigações Fiscais ({obrigacoesList.length})</span>
                </CardTitle>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Vencimentos de guias federais, estaduais e municipais desta empresa
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/obrigacoes')}
                className="text-xs h-8 rounded-xl border-[#E2E8F0] text-[#0FA3A3] hover:bg-teal-50"
              >
                Gerenciar no Calendário
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              {obrigacoesList.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#94A3B8]">
                  Nenhuma obrigação fiscal cadastrada para esta empresa.
                </div>
              ) : (
                <div className="space-y-2">
                  {obrigacoesList.map((ob) => {
                    const venc = ob.vencimento ? new Date(ob.vencimento) : null
                    const now = new Date()
                    const diffDays = venc
                      ? Math.ceil((venc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                      : 0

                    return (
                      <div
                        key={ob.id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Clock className="h-5 w-5 text-[#0FA3A3]" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-[#1A2333]">
                                {ob.tipo} — {ob.competencia}
                              </p>
                              {ob.exige_certificado && (
                                <Badge
                                  variant="outline"
                                  className="border-amber-300 bg-amber-50 text-amber-800 text-[10px] font-semibold"
                                >
                                  Exige e-CNPJ
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-[#64748B]">
                              Vencimento:{' '}
                              <span className="font-semibold text-[#1A2333]">
                                {ob.vencimento
                                  ? new Date(ob.vencimento).toLocaleDateString('pt-BR', {
                                      timeZone: 'UTC',
                                    })
                                  : '—'}
                              </span>
                              {ob.valor ? ` • Valor: R$ ${ob.valor.toFixed(2)}` : ''}
                              {ob.data_entrega
                                ? ` • Entregue em ${formatDatePtBr(ob.data_entrega)}`
                                : ''}
                            </p>
                            {ob.observacoes && (
                              <p className="text-[11px] text-[#94A3B8] italic mt-0.5">
                                {ob.observacoes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              ob.status === 'entregue'
                                ? 'bg-[#DCFCE7] text-[#166534]'
                                : ob.status === 'atrasada' ||
                                    (diffDays < 0 && ob.status !== 'cancelada')
                                  ? 'bg-[#FEE2E2] text-[#991B1B]'
                                  : diffDays <= 7
                                    ? 'bg-[#FEF3C7] text-[#92400E]'
                                    : 'bg-[#DBEAFE] text-[#1E40AF]'
                            }
                          >
                            {ob.status === 'entregue'
                              ? 'Entregue'
                              : ob.status === 'atrasada' || diffDays < 0
                                ? 'Atrasada'
                                : ob.status === 'em_andamento'
                                  ? 'Em Andamento'
                                  : 'Pendente'}
                          </Badge>

                          {ob.status !== 'entregue' && member?.perfil !== 'cliente' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarcarObrigacaoEntregue(ob.id)}
                              className="h-7 text-[11px] rounded-lg border-teal-300 text-teal-700 hover:bg-teal-50 font-semibold gap-1"
                              title="Marcar como entregue / transmitida"
                            >
                              <CheckCircle2 className="h-3 w-3 text-teal-600" />
                              <span>Marcar Entregue</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seção 2: Declarações Fiscais SPED/ECF/ECD (Collection fiscal) */}
          <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-[#3B82F6]" />
                  <span>Declarações Acessórias & SPED ({fiscalList.length})</span>
                </CardTitle>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Demonstrativos entregues e períodos de apuração fiscal
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {fiscalList.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#94A3B8]">
                  Nenhuma declaração fiscal lançada para esta empresa.
                </div>
              ) : (
                <div className="space-y-2">
                  {fiscalList.map((fisc) => (
                    <div
                      key={fisc.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Calculator className="h-5 w-5 text-[#3B82F6]" />
                        <div>
                          <p className="text-xs font-semibold text-[#1A2333] uppercase">
                            {fisc.tipo_obrigacao.replace('_', ' ')}
                          </p>
                          <p className="text-[11px] text-[#64748B]">
                            Período: {fisc.periodo_apuracao}{' '}
                            {fisc.data_entrega
                              ? `• Entregue em ${formatDatePtBr(fisc.data_entrega)}`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={
                          fisc.status === 'entregue' || fisc.status === 'aprovado'
                            ? 'bg-[#DCFCE7] text-[#166534]'
                            : fisc.status === 'pendente'
                              ? 'bg-[#FEF3C7] text-[#92400E]'
                              : 'bg-[#DBEAFE] text-[#1E40AF]'
                        }
                      >
                        {fisc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Integrações */}
        <TabsContent value="integracoes">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="rounded-2xl border border-slate-200 p-4 shadow-xs">
              <h4 className="text-xs font-bold text-[#1A2333]">Receita Federal (e-CAC)</h4>
              <p className="text-[11px] text-[#64748B] mt-1">
                Conexão para consulta de certidões negativas e situação cadastral.
              </p>
              <Badge variant="outline" className="mt-3 text-[10px] text-[#94A3B8]">
                Em breve (P1)
              </Badge>
            </Card>

            <Card className="rounded-2xl border border-teal-200 bg-teal-50/40 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#1A2333]">SEFAZ Distribuição DF-e</h4>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                  Disponível
                </Badge>
              </div>
              <p className="text-[11px] text-[#64748B] mt-1">
                Busca contínua de notas emitidas contra o CNPJ com manifestação e arquivamento no
                GED.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const el = document.querySelector('[value="nfe_recebidas"]') as HTMLElement
                  if (el) el.click()
                }}
                className="mt-3 text-xs h-7 text-[#0FA3A3] border-teal-300 hover:bg-teal-100"
              >
                Acessar Busca NF-e
              </Button>
            </Card>

            <Card className="rounded-2xl border border-slate-200 p-4 shadow-xs">
              <h4 className="text-xs font-bold text-[#1A2333]">Open Finance Bancário</h4>
              <p className="text-[11px] text-[#64748B] mt-1">
                Extratos automáticos para conciliação contábil ágil.
              </p>
              <Badge variant="outline" className="mt-3 text-[10px] text-[#94A3B8]">
                Em breve (P1)
              </Badge>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog to Encerrar */}
      <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-[#1A2333]">
              Confirmar Encerramento da Empresa
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Tem certeza que deseja marcar{' '}
              <strong>{empresa.nome_fantasia || empresa.razao_social}</strong> como encerrada? O
              escritório continuará com acesso a todos os históricos e arquivos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowCloseModal(false)}
              className="text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={closing}
              onClick={handleEncerrar}
              className="text-xs rounded-xl"
            >
              {closing ? 'Encerrando...' : 'Confirmar Encerramento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão Segura com Backup de 24h */}
      <ModalExclusaoEmpresa
        empresa={empresa}
        open={showExcluirModal}
        onOpenChange={setShowExcluirModal}
        usuarioId={user?.id || ''}
        onExclusaoConcluida={() => {
          navigate('/empresas')
        }}
      />

      {/* Modal de Criação de Migração para esta Empresa */}
      {tenant?.id && empresa && (
        <ModalNovoProcessoMigracao
          open={modalNovoMigracaoOpen}
          onOpenChange={setModalNovoMigracaoOpen}
          tenantId={tenant.id}
          empresas={[empresa]}
          empresaPreSelecionadaId={empresa.id}
          tipoPreSelecionado={tipoNovoMigracao}
          usuarioId={user?.id || ''}
          usuarioNome={user?.nome || user?.email || 'Contador'}
          onCriado={(novo) => {
            setProcessoMigracaoAtivo(novo)
            setSearchParams({ tab: 'migracao_onboarding' }, { replace: true })
          }}
        />
      )}

      {/* Modal Desacoplado para Cadastrar/Atualizar Certificado Digital da Empresa */}
      {tenant?.id && empresa && (
        <ModalSalvarCertificado
          open={showCertificadoModal}
          onOpenChange={setShowCertificadoModal}
          empresa={empresa}
          tenantId={tenant.id}
          certificadoExistente={certificado}
          canEdit={
            member?.perfil === 'administrador' ||
            member?.perfil === 'contador' ||
            isGestorEmpresas ||
            (user?.role as string) === 'administrador' ||
            (user?.role as string) === 'contador'
          }
          onSuccess={(salvo) => {
            setCertificado(salvo)
          }}
        />
      )}
    </div>
  )
}

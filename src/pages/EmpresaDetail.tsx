import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { documentosService } from '@/services/documentos'
import { workflowService } from '@/services/workflows'
import { fiscalService } from '@/services/fiscal'
import { certificadosService, type CertificadoSaudeInfo } from '@/services/certificados'
import { ShieldCheck, ShieldAlert, ShieldX, KeyRound, Download, AlertCircle } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { maskCnpj, formatDatePtBr } from '@/lib/formatters'
import type { Empresa, Documento, Workflow, FiscalRecord, CertificadoDigitalRecord } from '@/types'
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
  const { tenant } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [certificado, setCertificado] = useState<CertificadoDigitalRecord | null>(null)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [fiscalList, setFiscalList] = useState<FiscalRecord[]>([])
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
      const [docs, wfs, fisc, cert] = await Promise.all([
        documentosService.list(tenant.id, `empresa_id = "${id}"`),
        workflowService.list(tenant.id, `empresa_id = "${id}"`),
        fiscalService.list(tenant.id, `empresa_id = "${id}"`),
        certificadosService.getByEmpresa(id),
      ])
      setDocumentos(docs)
      setWorkflows(wfs)
      setFiscalList(fisc)
      setCertificado(cert)
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
              className="h-9 gap-2 rounded-xl text-xs text-[#EF4444] hover:bg-red-50 hover:text-red-700"
            >
              <Power className="h-3.5 w-3.5" />
              <span>Encerrar Empresa</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Layout: Visão Geral, Certificado Digital, Documentos, Workflows, Fiscal, Integrações */}
      <Tabs defaultValue="visao_geral" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl h-11 w-full justify-start overflow-x-auto">
          <TabsTrigger value="visao_geral" className="rounded-lg text-xs font-semibold gap-2">
            <Building2 className="h-4 w-4" />
            <span>Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="certificado" className="rounded-lg text-xs font-semibold gap-2">
            <KeyRound className="h-4 w-4" />
            <span>
              Certificado Digital{' '}
              {certificado && (
                <span className="ml-1 inline-block h-2 w-2 rounded-full bg-teal-500" />
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
          <TabsTrigger value="fiscal" className="rounded-lg text-xs font-semibold gap-2">
            <Calculator className="h-4 w-4" />
            <span>Fiscal ({fiscalList.length})</span>
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
                    onClick={() => navigate(`/empresas/${empresa.id}/editar`)}
                    className="w-full gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold h-9"
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
                  onClick={() => navigate(`/empresas/${empresa.id}/editar`)}
                  className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold h-9"
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
                        <div>
                          <p className="text-xs font-semibold text-[#1A2333]">{doc.nome_arquivo}</p>
                          <p className="text-[11px] text-[#64748B] capitalize">
                            Tipo: {doc.tipo.replace('_', ' ')} • Enviado em{' '}
                            {formatDatePtBr(doc.created)}
                          </p>
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

        {/* Tab 4: Fiscal */}
        <TabsContent value="fiscal">
          <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
            <CardContent className="p-4">
              {fiscalList.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#94A3B8]">
                  Nenhuma obrigação fiscal lançada para esta empresa.
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

            <Card className="rounded-2xl border border-slate-200 p-4 shadow-xs">
              <h4 className="text-xs font-bold text-[#1A2333]">SEFAZ / Prefeituras</h4>
              <p className="text-[11px] text-[#64748B] mt-1">
                Importação automática de notas fiscais e arquivos XML/DANFE.
              </p>
              <Badge variant="outline" className="mt-3 text-[10px] text-[#94A3B8]">
                Em breve (P1)
              </Badge>
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
    </div>
  )
}

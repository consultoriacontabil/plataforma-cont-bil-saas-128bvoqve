import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { RumoLogo } from '@/components/RumoLogo'
import {
  ShieldCheck,
  ShieldAlert,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Users,
  Paperclip,
  Check,
  RefreshCw,
  Plus,
  Trash2,
  Save,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react'
import { companyOnboardingService } from '@/services/companyOnboarding'
import type {
  CompanyOnboardingWorkflowRecord,
  OnboardingChecklistItem,
  DadosPreliminaresOnboarding,
  NaturezaJuridicaTipo,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { maskCnpj, maskCpf, maskPhone } from '@/lib/formatters'

export default function AberturaClientePublicoPage() {
  const { token } = useParams<{ token: string }>()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [workflow, setWorkflow] = useState<CompanyOnboardingWorkflowRecord | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)
  const [savingDados, setSavingDados] = useState(false)

  // Formulário preliminar
  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [naturezaJuridica, setNaturezaJuridica] = useState<NaturezaJuridicaTipo>('slu')
  const [cnpjPretendido, setCnpjPretendido] = useState('')
  const [cnaePrincipal, setCnaePrincipal] = useState('')
  const [capitalSocial, setCapitalSocial] = useState<number>(10000)
  const [clienteNome, setClienteNome] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')

  // Sócios
  const [socios, setSocios] = useState<
    Array<{
      nome: string
      cpf: string
      email?: string
      telefone?: string
      percentual_cotas: number
    }>
  >([])

  const carregarWorkflow = async () => {
    if (!token) {
      setErrorMsg('Token de acesso não informado no link.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setErrorMsg('')
      const data = await companyOnboardingService.getByToken(token)

      if (!data) {
        setErrorMsg('Link de abertura não encontrado ou código inválido.')
        return
      }

      if (data.link_ativo === false) {
        setErrorMsg('Este link de abertura foi revogado pelo escritório contábil.')
        return
      }

      if (data.expira_em) {
        const expDate = new Date(data.expira_em)
        if (expDate.getTime() < Date.now()) {
          setErrorMsg('Este link de abertura expirou. Solicite um novo link ao seu contador.')
          return
        }
      }

      setWorkflow(data)

      // Preenche os campos caso já existam (se não houver nada, mantém vazio)
      const prelim = data.dados_preliminares_json || {}
      setRazaoSocial(data.razao_social_pretendida || prelim.razao_social_pretendida || '')
      setNomeFantasia(data.nome_fantasia_pretendido || prelim.nome_fantasia_pretendido || '')
      setNaturezaJuridica(data.natureza_juridica || prelim.natureza_juridica || 'slu')
      setCnpjPretendido(prelim.cnpj_pretendido || '')
      setCnaePrincipal(
        prelim.cnae_principal_codigo
          ? `${prelim.cnae_principal_codigo} - ${prelim.cnae_principal_descricao || ''}`
          : '',
      )
      // Capital social e sócios iniciam vazios em novos workflows
      setCapitalSocial(prelim.capital_social_pretendido || 0)
      setClienteNome(data.cliente_nome || '')
      setClienteEmail(data.cliente_email || '')
      setClienteTelefone(data.cliente_telefone || '')
      setSocios(
        prelim.socios && prelim.socios.length > 0
          ? prelim.socios
          : data.cliente_nome
            ? [
                {
                  nome: data.cliente_nome,
                  cpf: '',
                  email: data.cliente_email || '',
                  telefone: data.cliente_telefone || '',
                  percentual_cotas: 100,
                },
              ]
            : [],
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao buscar workflow.'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarWorkflow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Upload do arquivo pelo cliente
  const handleUploadArquivo = async (item: OnboardingChecklistItem, file: File) => {
    if (!workflow) return

    // Validações básicas de segurança (max 25MB, formatos aceitos)
    const extensoesValidas = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!extensoesValidas.includes(ext)) {
      toast({
        variant: 'destructive',
        title: 'Formato não suportado',
        description: 'Por favor envie arquivos em formato PDF, JPG, PNG ou DOCX.',
      })
      return
    }

    if (file.size > 25 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O tamanho limite do arquivo é de 25 MB.',
      })
      return
    }

    try {
      setUploadingItemId(item.id)
      const updated = await companyOnboardingService.uploadDocumentoPublico(workflow, item.id, file)
      setWorkflow(updated)
      toast({
        title: 'Documento enviado com sucesso!',
        description: `O arquivo ${file.name} foi catalogado e encaminhado para validação do escritório contábil.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao enviar documento.'
      toast({
        variant: 'destructive',
        title: 'Erro no envio',
        description: msg,
      })
    } finally {
      setUploadingItemId(null)
    }
  }

  // Salvar dados preliminares
  const handleSalvarDados = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workflow) return

    try {
      setSavingDados(true)
      const payload: DadosPreliminaresOnboarding = {
        razao_social_pretendida: razaoSocial.trim(),
        nome_fantasia_pretendido: nomeFantasia.trim(),
        natureza_juridica: naturezaJuridica,
        cnpj_pretendido: cnpjPretendido,
        capital_social_pretendido: capitalSocial,
        socios,
      }

      const updated = await companyOnboardingService.salvarDadosPreliminaresPublico(
        workflow,
        payload,
        {
          nome: clienteNome.trim(),
          email: clienteEmail.trim(),
          telefone: clienteTelefone.trim(),
        },
      )
      setWorkflow(updated)
      toast({
        title: 'Informações salvas com sucesso!',
        description: 'Os dados da futura empresa foram salvos no fluxo de abertura.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar informações.'
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: msg,
      })
    } finally {
      setSavingDados(false)
    }
  }

  // Exclusão de documento do checklist pelo cliente (se ainda não aprovado)
  const handleRemoverArquivoCliente = async (item: OnboardingChecklistItem) => {
    if (!workflow) return
    if (item.status === 'aprovado') {
      toast({
        variant: 'destructive',
        title: 'Não é possível excluir',
        description:
          'Este documento já foi conferido e aprovado pelo contador. Entre em contato com seu escritório para substituição.',
      })
      return
    }

    const confirmar = window.confirm(
      `Deseja realmente excluir o documento anexado ao item "${item.titulo}"?`,
    )
    if (!confirmar) return

    try {
      setUploadingItemId(item.id)
      const updated = await companyOnboardingService.removerDocumentoChecklist(
        workflow,
        item.id,
        'cliente_publico',
        'cliente',
      )
      setWorkflow(updated)
      toast({
        title: 'Documento removido',
        description: `O anexo do item "${item.titulo}" foi excluído com sucesso.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao remover documento.'
      toast({
        variant: 'destructive',
        title: 'Erro ao remover',
        description: msg,
      })
    } finally {
      setUploadingItemId(null)
    }
  }

  // Limpar todos os dados preliminares preenchidos
  const handleLimparDadosPreliminares = async () => {
    if (!workflow) return
    const confirmar = window.confirm(
      'Deseja limpar todos os campos preenchidos da futura empresa e quadro de sócios?',
    )
    if (!confirmar) return

    try {
      setSavingDados(true)
      const updated = await companyOnboardingService.limparDadosPreliminares(
        workflow,
        'cliente_publico',
        'cliente',
      )
      setWorkflow(updated)
      setRazaoSocial('')
      setNomeFantasia('')
      setCnpjPretendido('')
      setCapitalSocial(0)
      setClienteNome('')
      setClienteEmail('')
      setClienteTelefone('')
      setSocios([])
      toast({
        title: 'Campos limpos com sucesso',
        description: 'Todos os dados preliminares foram apagados do formulário.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao limpar dados.'
      toast({
        variant: 'destructive',
        title: 'Erro ao limpar',
        description: msg,
      })
    } finally {
      setSavingDados(false)
    }
  }

  // Manipulação de sócios no formulário preliminar
  const handleAddSocio = () => {
    setSocios([
      ...socios,
      {
        nome: '',
        cpf: '',
        email: '',
        telefone: '',
        percentual_cotas: 0,
      },
    ])
  }

  const handleRemoveSocio = (index: number) => {
    setSocios(socios.filter((_, i) => i !== index))
  }

  const handleUpdateSocio = (
    index: number,
    field: 'nome' | 'cpf' | 'email' | 'telefone' | 'percentual_cotas',
    value: string | number,
  ) => {
    const updated = [...socios]
    updated[index] = { ...updated[index], [field]: value }
    setSocios(updated)
  }

  // Cálculos do checklist
  const checklist = workflow?.checklist_docs_json || []
  const enviadosCount = checklist.filter(
    (it) => it.status === 'enviado' || it.status === 'aprovado',
  ).length
  const aprovadosCount = checklist.filter((it) => it.status === 'aprovado').length
  const totalCount = checklist.length
  const percConcluido = totalCount > 0 ? Math.round((enviadosCount / totalCount) * 100) : 0

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#1A2333] flex flex-col justify-between">
      {/* Topbar Público */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E2E8F0] bg-white px-4 md:px-8 shadow-2xs">
        <div className="flex items-center gap-3">
          <RumoLogo
            size={38}
            variant="light"
            title="Abertura de Empresa"
            subtitle="Portal do Cliente • Rumo Consultoria Contábil"
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[11px] font-medium border-teal-200 text-teal-800 bg-teal-50 gap-1.5"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#0FA3A3]" />
            <span>Ambiente Seguro</span>
          </Badge>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-[#0FA3A3]" />
            <p className="text-xs text-[#64748B]">Carregando checklist de abertura...</p>
          </div>
        ) : errorMsg ? (
          /* Erro ou Link Inválido */
          <Card className="rounded-2xl border-rose-200 bg-white shadow-2xs max-w-xl mx-auto mt-8">
            <CardContent className="p-8 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-[#1A2333]">Link de Abertura Indisponível</h3>
                <p className="text-xs text-[#64748B] leading-relaxed">{errorMsg}</p>
              </div>
              <div className="pt-2">
                <p className="text-[11px] text-[#94A3B8]">
                  Se você acredita que isso é um engano, entre em contato com a equipe da Rumo
                  Consultoria Contábil pelo WhatsApp ou telefone de suporte.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          workflow && (
            <div className="space-y-6 animate-fade-in">
              {/* Header do Processo */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-[#0FA3A3] text-white text-xs font-bold uppercase">
                      {workflow.natureza_juridica?.toUpperCase() || 'SLU'}
                    </Badge>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-[#1A2333]">
                      {workflow.razao_social_pretendida ||
                        workflow.titulo ||
                        'Abertura de Nova Empresa'}
                    </h1>
                  </div>
                  <p className="text-xs text-[#64748B] max-w-2xl leading-relaxed">
                    Bem-vindo ao canal oficial de envio de documentos para a constituição da sua
                    empresa. Anexe os documentos solicitados abaixo para que nossos contadores
                    possam dar entrada na Junta Comercial e órgãos reguladores.
                  </p>
                </div>

                {/* Card de Progresso */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 shrink-0 min-w-[220px] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#1A2333]">Documentos Enviados:</span>
                    <span className="font-bold text-[#0FA3A3]">
                      {enviadosCount}/{totalCount}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0FA3A3] transition-all duration-300"
                      style={{ width: `${percConcluido}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#64748B]">
                    <span>{aprovadosCount} aprovados</span>
                    <span className="font-semibold text-teal-800">{percConcluido}% concluído</span>
                  </div>
                </div>
              </div>

              {/* Abas Principais: 1. Checklist de Documentos | 2. Dados da Futura Empresa */}
              <Tabs defaultValue="checklist" className="space-y-5">
                <TabsList className="bg-white border border-[#E2E8F0] p-1 rounded-xl h-11 w-full justify-start shadow-2xs">
                  <TabsTrigger
                    value="checklist"
                    className="rounded-lg text-xs font-semibold gap-2 h-9 data-[state=active]:bg-[#0B1F3A] data-[state=active]:text-white"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Checklist de Documentos ({checklist.length})</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="dados"
                    className="rounded-lg text-xs font-semibold gap-2 h-9 data-[state=active]:bg-[#0B1F3A] data-[state=active]:text-white"
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Dados da Futura Empresa & Sócios</span>
                  </TabsTrigger>
                </TabsList>

                {/* ABA 1: Checklist com Status para o Cliente */}
                <TabsContent value="checklist" className="space-y-4">
                  <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
                    <CardHeader className="p-5 pb-3 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm font-bold text-[#1A2333]">
                          Documentos Solicitados para Registro
                        </CardTitle>
                        <CardDescription className="text-xs text-[#64748B] mt-0.5">
                          Aceitamos arquivos em PDF, JPG ou PNG de até 25MB por documento.
                        </CardDescription>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[11px] font-medium text-slate-700 w-fit"
                      >
                        Status atual:{' '}
                        <span className="font-bold ml-1 text-[#0FA3A3]">
                          {workflow.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </Badge>
                    </CardHeader>

                    <CardContent className="p-5 divide-y divide-slate-100">
                      {checklist.length === 0 ? (
                        <p className="text-xs text-center py-8 text-[#94A3B8]">
                          Nenhum documento listado no checklist até o momento.
                        </p>
                      ) : (
                        checklist.map((item) => {
                          const isPendente = item.status === 'pendente'
                          const isEnviado = item.status === 'enviado'
                          const isAprovado = item.status === 'aprovado'
                          const isRecusado = item.status === 'recusado'

                          return (
                            <div
                              key={item.id}
                              className="py-4 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                            >
                              <div className="space-y-1.5 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-[#1A2333]">
                                    {item.titulo}
                                  </span>
                                  {item.obrigatorio ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] text-rose-700 border-rose-200 bg-rose-50"
                                    >
                                      Obrigatório
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] text-slate-500 border-slate-200"
                                    >
                                      Opcional
                                    </Badge>
                                  )}

                                  {/* Badge de Status */}
                                  {isAprovado && (
                                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px] gap-1 font-bold">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Aprovado pelo Contador
                                    </Badge>
                                  )}
                                  {isEnviado && (
                                    <Badge className="bg-blue-100 text-blue-800 text-[10px] gap-1 font-bold">
                                      <Clock className="h-3 w-3" />
                                      Enviado (Em Análise)
                                    </Badge>
                                  )}
                                  {isRecusado && (
                                    <Badge className="bg-rose-100 text-rose-800 text-[10px] gap-1 font-bold">
                                      <AlertTriangle className="h-3 w-3" />
                                      Recusado — Necessário Reenviar
                                    </Badge>
                                  )}
                                  {isPendente && (
                                    <Badge className="bg-amber-100 text-amber-800 text-[10px] gap-1 font-bold">
                                      <Clock className="h-3 w-3" />
                                      Pendente de Envio
                                    </Badge>
                                  )}
                                </div>

                                {item.detalhe && (
                                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                                    {item.detalhe}
                                  </p>
                                )}

                                {/* Arquivo anexado */}
                                {item.nome_arquivo && (
                                  <div className="flex items-center gap-2 text-[11px] font-mono text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md w-fit border border-teal-100">
                                    <Paperclip className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                                    <span className="truncate max-w-xs">{item.nome_arquivo}</span>
                                    {item.enviado_em && (
                                      <span className="text-[10px] text-teal-600">
                                        • {new Date(item.enviado_em).toLocaleDateString('pt-BR')}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Destaque do Motivo da Recusa */}
                                {isRecusado && item.motivo_recusa && (
                                  <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-900 space-y-1">
                                    <div className="flex items-center gap-1.5 font-bold">
                                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                                      <span>Motivo do Apontamento do Contador:</span>
                                    </div>
                                    <p className="text-[11px] pl-5.5 leading-relaxed">
                                      {item.motivo_recusa}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Ações de Upload e Exclusão */}
                              <div className="shrink-0 flex items-center gap-2">
                                {isAprovado ? (
                                  <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                                    <Check className="h-4 w-4" />
                                    <span>Concluído e Validado</span>
                                  </div>
                                ) : (
                                  <>
                                    <label className="cursor-pointer">
                                      <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) handleUploadArquivo(item, file)
                                        }}
                                        disabled={uploadingItemId === item.id}
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        asChild
                                        className={`h-9 px-4 rounded-xl text-xs font-semibold gap-1.5 cursor-pointer shadow-xs ${
                                          isRecusado
                                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                            : isEnviado
                                              ? 'bg-white hover:bg-slate-50 text-[#1A2333] border border-[#E2E8F0]'
                                              : 'bg-[#0FA3A3] hover:bg-[#0C8585] text-white'
                                        }`}
                                      >
                                        <span>
                                          {uploadingItemId === item.id ? (
                                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <Upload className="h-3.5 w-3.5" />
                                          )}
                                          <span>
                                            {uploadingItemId === item.id
                                              ? 'Enviando...'
                                              : isRecusado
                                                ? 'Reenviar Documento Corrigido'
                                                : isEnviado
                                                  ? 'Substituir Arquivo'
                                                  : 'Enviar Documento'}
                                          </span>
                                        </span>
                                      </Button>
                                    </label>

                                    {/* Opção de Excluir Anexo (permitido enquanto não aprovado) */}
                                    {(isEnviado || isRecusado || item.nome_arquivo) && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={uploadingItemId === item.id}
                                        onClick={() => handleRemoverArquivoCliente(item)}
                                        title="Excluir documento anexado"
                                        className="h-9 px-2.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only sm:not-sr-only sm:ml-1">
                                          Excluir
                                        </span>
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ABA 2: Dados da Futura Empresa & Sócios */}
                <TabsContent value="dados" className="space-y-4">
                  <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
                    <CardHeader className="p-5 pb-3 border-b border-[#E2E8F0]">
                      <CardTitle className="text-sm font-bold text-[#1A2333]">
                        Dados da Futura Empresa & Quadro Societário
                      </CardTitle>
                      <CardDescription className="text-xs text-[#64748B]">
                        Preencha as informações que orientarão a elaboração do contrato social e
                        viabilidade.
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-5">
                      <form onSubmit={handleSalvarDados} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-[#1A2333]">
                              Razão Social Pretendida (1ª Opção) *
                            </Label>
                            <Input
                              value={razaoSocial}
                              onChange={(e) => setRazaoSocial(e.target.value)}
                              placeholder="Ex.: Innova Soluções em Tecnologia LTDA"
                              className="h-10 text-xs rounded-xl border-[#E2E8F0]"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-[#1A2333]">
                              Nome Fantasia Pretendido
                            </Label>
                            <Input
                              value={nomeFantasia}
                              onChange={(e) => setNomeFantasia(e.target.value)}
                              placeholder="Ex.: Innova Tech"
                              className="h-10 text-xs rounded-xl border-[#E2E8F0]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-[#1A2333]">
                              Tipo Societário Pretendido
                            </Label>
                            <Select
                              value={naturezaJuridica}
                              onValueChange={(val) =>
                                setNaturezaJuridica(val as NaturezaJuridicaTipo)
                              }
                            >
                              <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="slu">
                                  SLU - Sociedade Limitada Unipessoal (1 Sócio)
                                </SelectItem>
                                <SelectItem value="ltda">
                                  LTDA - Sociedade Empresária (2+ Sócios)
                                </SelectItem>
                                <SelectItem value="mei">
                                  MEI - Microempreendedor Individual
                                </SelectItem>
                                <SelectItem value="ei">EI - Empresário Individual</SelectItem>
                                <SelectItem value="sociedade_simples_pura">
                                  Sociedade Simples (Cartório RCPJ)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-[#1A2333]">
                              Capital Social Previsto (R$)
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step="100"
                              value={capitalSocial}
                              onChange={(e) => setCapitalSocial(parseFloat(e.target.value) || 0)}
                              className="h-10 text-xs rounded-xl border-[#E2E8F0]"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-[#1A2333]">
                              CNPJ (se já possuir pré-cadastro)
                            </Label>
                            <Input
                              value={cnpjPretendido}
                              onChange={(e) => setCnpjPretendido(maskCnpj(e.target.value))}
                              placeholder="00.000.000/0000-00"
                              className="h-10 text-xs rounded-xl border-[#E2E8F0] font-mono"
                            />
                          </div>
                        </div>

                        {/* Dados de Contato do Solicitante / Cliente */}
                        <div className="pt-2 border-t border-slate-100">
                          <h4 className="text-xs font-bold text-[#1A2333] mb-3">
                            Dados de Contato do Responsável
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-[#64748B]">Nome Completo</Label>
                              <Input
                                value={clienteNome}
                                onChange={(e) => setClienteNome(e.target.value)}
                                placeholder="Seu nome"
                                className="h-9 text-xs rounded-xl"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-[#64748B]">E-mail</Label>
                              <Input
                                type="email"
                                value={clienteEmail}
                                onChange={(e) => setClienteEmail(e.target.value)}
                                placeholder="seu@email.com"
                                className="h-9 text-xs rounded-xl"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-[#64748B]">
                                Telefone / WhatsApp
                              </Label>
                              <Input
                                value={clienteTelefone}
                                onChange={(e) => setClienteTelefone(maskPhone(e.target.value))}
                                placeholder="(00) 00000-0000"
                                className="h-9 text-xs rounded-xl"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Quadro de Sócios */}
                        <div className="pt-2 border-t border-slate-100 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-[#1A2333]">
                                Quadro de Sócios Pretendido
                              </h4>
                              <p className="text-[11px] text-[#64748B]">
                                Adicione todos os titulares ou sócios participantes
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleAddSocio}
                              className="h-8 text-xs rounded-xl gap-1 border-[#E2E8F0]"
                            >
                              <Plus className="h-3.5 w-3.5 text-[#0FA3A3]" />
                              <span>Adicionar Sócio</span>
                            </Button>
                          </div>

                          <div className="space-y-3">
                            {socios.map((socio, idx) => (
                              <div
                                key={idx}
                                className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-[#1A2333]">
                                    Sócio #{idx + 1}
                                  </span>
                                  {socios.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveSocio(idx)}
                                      className="h-6 px-2 text-rose-600 hover:text-rose-800 text-[11px]"
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" /> Remover
                                    </Button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                                  <div className="sm:col-span-2 space-y-0.5">
                                    <Label className="text-[10px] text-[#64748B]">
                                      Nome do Sócio *
                                    </Label>
                                    <Input
                                      value={socio.nome}
                                      onChange={(e) =>
                                        handleUpdateSocio(idx, 'nome', e.target.value)
                                      }
                                      placeholder="Nome completo"
                                      className="h-8 text-xs rounded-lg bg-white"
                                      required
                                    />
                                  </div>
                                  <div className="space-y-0.5">
                                    <Label className="text-[10px] text-[#64748B]">CPF *</Label>
                                    <Input
                                      value={socio.cpf}
                                      onChange={(e) =>
                                        handleUpdateSocio(idx, 'cpf', maskCpf(e.target.value))
                                      }
                                      placeholder="000.000.000-00"
                                      className="h-8 text-xs rounded-lg bg-white font-mono"
                                      required
                                    />
                                  </div>
                                  <div className="space-y-0.5">
                                    <Label className="text-[10px] text-[#64748B]">
                                      Participação (%)
                                    </Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      max="100"
                                      value={socio.percentual_cotas}
                                      onChange={(e) =>
                                        handleUpdateSocio(
                                          idx,
                                          'percentual_cotas',
                                          parseFloat(e.target.value) || 0,
                                        )
                                      }
                                      className="h-8 text-xs rounded-lg bg-white font-semibold"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          {(razaoSocial ||
                            nomeFantasia ||
                            cnpjPretendido ||
                            capitalSocial > 0 ||
                            socios.length > 0) && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleLimparDadosPreliminares}
                              disabled={savingDados}
                              className="rounded-xl text-xs text-rose-600 border-rose-200 hover:bg-rose-50 h-10 px-4 gap-1.5"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>Limpar Dados Preenchidos</span>
                            </Button>
                          )}
                          <div className="ml-auto">
                            <Button
                              type="submit"
                              disabled={savingDados}
                              className="rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold h-10 px-6 gap-2 shadow-xs"
                            >
                              {savingDados ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                              <span>Salvar Informações da Empresa</span>
                            </Button>
                          </div>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E2E8F0] bg-white py-6 px-4 text-center text-xs text-[#64748B] mt-12">
        <p className="font-semibold text-[#1A2333]">
          Plataforma Contábil Rumo — Workflow Oficial de Abertura e Legalização Empresarial
        </p>
        <p className="text-[11px] mt-1 text-[#94A3B8]">
          Curitiba / PR • Atendimento em conformidade com DREI e Junta Comercial
        </p>
      </footer>
    </div>
  )
}

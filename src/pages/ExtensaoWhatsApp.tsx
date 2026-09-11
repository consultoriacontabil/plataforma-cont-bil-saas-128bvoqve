import React, { useState, useEffect } from 'react'
import {
  Download,
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  Info,
  Key,
  FolderArchive,
  Layers,
  Sparkles,
  UserPlus,
  FileText,
  Send,
  MessageSquare,
  Building2,
  RefreshCw,
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
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { downloadExtensionZip, EXTENSION_SOURCE_FILES } from '@/services/extensionBundle'
import { whatsappService } from '@/services/whatsapp'
import { empresasService } from '@/services/empresas'
import type { WhatsAppLeadContatoRecord, WhatsAppTemplateRecord, Empresa } from '@/types'
import { toast } from '@/hooks/use-toast'

export default function ExtensaoWhatsAppPage() {
  const { user, tenant, isCliente } = useAuth()

  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Dados da plataforma
  const [leads, setLeads] = useState<WhatsAppLeadContatoRecord[]>([])
  const [templates, setTemplates] = useState<WhatsAppTemplateRecord[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // Modal para criar empresa a partir do contato capturado
  const [leadParaCriarEmpresa, setLeadParaCriarEmpresa] =
    useState<WhatsAppLeadContatoRecord | null>(null)
  const [modalCriarEmpresaOpen, setModalCriarEmpresaOpen] = useState(false)
  const [novaRazaoSocial, setNovaRazaoSocial] = useState('')
  const [novoCnpj, setNovoCnpj] = useState('')
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false)

  // Simulador Assistivo
  const [simContato, setSimContato] = useState('Dr. Carlos Mendes')
  const [simEmpresa, setSimEmpresa] = useState('Mendes & Filhos Odontologia')
  const [simValor, setSimValor] = useState('R$ 1.850,00')
  const [simVencimento, setSimVencimento] = useState('20/09/2026')
  const [simSelectedTemplate, setSimSelectedTemplate] = useState<string>('')
  const [simPreviewTexto, setSimPreviewTexto] = useState<string>('')
  const [simEnviadoWhatsApp, setSimEnviadoWhatsApp] = useState(false)

  // Token de sessão atual
  const currentToken = pb.authStore.token || ''
  const currentPlatformUrl = window.location.origin

  const loadData = async () => {
    if (!tenant?.id) return
    setLoadingData(true)
    try {
      const [leadsList, templatesList, empresasList] = await Promise.all([
        whatsappService.listLeads(tenant.id),
        whatsappService.listTemplates(tenant.id),
        empresasService.list(tenant.id),
      ])
      setLeads(leadsList)
      setTemplates(templatesList)
      setEmpresas(empresasList)

      if (templatesList.length > 0 && !simSelectedTemplate) {
        setSimSelectedTemplate(templatesList[0].id)
      }
    } catch (err) {
      console.error('Erro ao carregar dados do WhatsApp:', err)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [tenant?.id])

  // Atualizar preview do simulador assistivo
  useEffect(() => {
    const tpl = templates.find((t) => t.id === simSelectedTemplate)
    if (!tpl) {
      setSimPreviewTexto('')
      return
    }

    const preview = tpl.conteudo
      .replace(/\{\{contato\}\}/g, simContato)
      .replace(/\{\{empresa\}\}/g, simEmpresa)
      .replace(/\{\{valor\}\}/g, simValor)
      .replace(/\{\{data_vencimento\}\}/g, simVencimento)
      .replace(/\{\{escritorio\}\}/g, tenant?.nome || 'Rumo Consultoria Contábil')
      .replace(/\{\{obrigacao\}\}/g, 'DAS - Simples Nacional')
      .replace(/\{\{portal_url\}\}/g, `${window.location.origin}/portal`)

    setSimPreviewTexto(preview)
  }, [
    simSelectedTemplate,
    simContato,
    simEmpresa,
    simValor,
    simVencimento,
    templates,
    tenant?.nome,
  ])

  const handleCopyToken = () => {
    if (!currentToken) {
      toast({
        title: 'Sessão expirada',
        description: 'Faça login novamente para gerar um novo token de conexão.',
        variant: 'destructive',
      })
      return
    }
    navigator.clipboard.writeText(currentToken)
    setCopiedToken(true)
    toast({
      title: 'Token de Conexão Copiado!',
      description: 'Cole este token no popup da extensão Rumo no Google Chrome.',
    })
    setTimeout(() => setCopiedToken(false), 3000)
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentPlatformUrl)
    setCopiedUrl(true)
    toast({
      title: 'URL da Plataforma Copiada!',
      description: 'Cole a URL no popup da extensão.',
    })
    setTimeout(() => setCopiedUrl(false), 3000)
  }

  const handleDownloadZip = () => {
    setDownloading(true)
    try {
      downloadExtensionZip()
      toast({
        title: 'Download iniciado!',
        description: 'Arquivo "rumo-extensao-whatsapp-mv3.zip" pronto para instalação.',
      })
    } catch (err) {
      console.error('Falha no download:', err)
      toast({
        title: 'Erro ao gerar pacote',
        description: 'Tente novamente ou baixe os arquivos da pasta pública.',
        variant: 'destructive',
      })
    } finally {
      setTimeout(() => setDownloading(false), 800)
    }
  }

  const handleSimularPreenchimentoWhatsApp = () => {
    setSimEnviadoWhatsApp(true)
    toast({
      title: 'Pré-preenchimento concluído no WhatsApp Web!',
      description:
        'Texto inserido com foco na caixa de mensagem. O operador confere e clica em enviar.',
    })
    setTimeout(() => setSimEnviadoWhatsApp(false), 3500)
  }

  const handleAbrirModalCriarEmpresa = (lead: WhatsAppLeadContatoRecord) => {
    setLeadParaCriarEmpresa(lead)
    setNovaRazaoSocial(lead.nome_contato)
    setNovoCnpj('')
    setModalCriarEmpresaOpen(true)
  }

  const handleSalvarEmpresaDoLead = async () => {
    if (!tenant?.id || !leadParaCriarEmpresa || !novaRazaoSocial.trim()) return
    setSalvandoEmpresa(true)
    try {
      const novaEmpresa = await empresasService.create({
        tenant_id: tenant.id,
        razao_social: novaRazaoSocial.trim(),
        nome_fantasia: leadParaCriarEmpresa.nome_contato,
        cnpj: novoCnpj.trim() || '00.000.000/0001-00',
        telefone: leadParaCriarEmpresa.telefone,
        status: 'pendente',
        regime_tributario: 'simples_nacional',
        porte: 'me',
        observacoes: `Empresa cadastrada a partir de contato capturado via WhatsApp Web por ${user?.name || 'usuário'}. Obs original: ${leadParaCriarEmpresa.observacoes || 'Nenhuma'}`,
      })

      // Vincular o lead à empresa criada
      await whatsappService.associarEmpresa(
        leadParaCriarEmpresa.id,
        novaEmpresa.id,
        user?.id,
        tenant.id,
      )

      toast({
        title: 'Empresa cadastrada com sucesso!',
        description: `"${novaEmpresa.razao_social}" vinculada ao contato do WhatsApp.`,
      })
      setModalCriarEmpresaOpen(false)
      loadData()
    } catch (err) {
      console.error('Erro ao criar empresa:', err)
      toast({
        title: 'Erro ao criar empresa',
        description: 'Verifique os dados informados.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoEmpresa(false)
    }
  }

  if (isCliente) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-[#1A2333]">Acesso Restrito</h2>
        <p className="text-sm text-[#64748B] mt-2">
          Esta área é exclusiva para operadores e contadores do escritório.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header com Banner e Ações Principais */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-100 text-[#0FA3A3]">
              <MessageSquare className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#0FA3A3]">
              Extensão Chrome Manifest V3
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
            Assistente WhatsApp Web Contábil
          </h2>
          <p className="text-xs text-[#64748B]">
            Agilidade operacional com envio de documentos, templates inteligentes e captura de
            contatos em modo 100% assistivo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleDownloadZip}
            disabled={downloading}
            className="bg-gradient-to-r from-[#0FA3A3] to-[#123B6D] text-white hover:opacity-90 shadow-sm"
          >
            <Download className="mr-2 h-4 w-4" />
            {downloading ? 'Gerando Pacote...' : 'Baixar Extensão (.ZIP)'}
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open('https://web.whatsapp.com', '_blank')}
            className="border-slate-200 text-[#1A2333] hover:bg-slate-50"
          >
            <ExternalLink className="mr-2 h-4 w-4 text-[#0FA3A3]" />
            Abrir WhatsApp Web
          </Button>
        </div>
      </div>

      {/* Alerta de Segurança e Termos do WhatsApp: Modo Assistivo Obrigatório */}
      <div className="rounded-2xl border border-teal-300 bg-gradient-to-r from-teal-50/80 via-emerald-50/50 to-white p-5 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0FA3A3] text-white shadow-xs">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0B1F3A]">
                Modo Assistivo Seguro — 100% em Conformidade com o WhatsApp
              </h3>
              <Badge className="bg-[#0FA3A3] text-white text-[10px] font-bold">Anti-Bloqueio</Badge>
            </div>
            <p className="text-xs text-[#334155] leading-relaxed">
              A extensão Rumo Contábil <strong>NÃO realiza disparos automáticos em massa</strong>{' '}
              nem clica em enviar sozinha. Ela funciona como um assistente de produtividade:
              pré-preenche o texto com variáveis no chat aberto e anexa os documentos oficiais.{' '}
              <strong>O envio é sempre conferido e confirmado manualmente por você.</strong> Isso
              protege o seu número e o seu escritório contra bloqueios e sanções.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Principais da Página */}
      <Tabs defaultValue="instalacao" className="w-full space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="instalacao" className="text-xs font-semibold gap-2">
            <FolderArchive className="h-3.5 w-3.5" />
            Passo a Passo de Instalação
          </TabsTrigger>
          <TabsTrigger value="conexao" className="text-xs font-semibold gap-2">
            <Key className="h-3.5 w-3.5" />
            Token & Configuração
          </TabsTrigger>
          <TabsTrigger value="simulador" className="text-xs font-semibold gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Simulador & Templates
          </TabsTrigger>
          <TabsTrigger value="leads" className="text-xs font-semibold gap-2">
            <UserPlus className="h-3.5 w-3.5" />
            Contatos Capturados ({leads.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: INSTALAÇÃO NO CHROME */}
        <TabsContent value="instalacao" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Passo 1 */}
            <Card className="rounded-2xl border-slate-200 shadow-xs relative overflow-hidden">
              <div className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-[#0FA3A3]">
                1
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#1A2333]">Baixar o Pacote</CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Arquivo ZIP da extensão
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-[#475569]">
                <p>
                  Clique no botão abaixo para baixar o pacote compactado contendo todos os arquivos
                  MV3.
                </p>
                <Button
                  size="sm"
                  onClick={handleDownloadZip}
                  className="w-full bg-[#0FA3A3] hover:bg-[#0d8c8c] text-white text-xs"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Baixar Pacote .ZIP
                </Button>
              </CardContent>
            </Card>

            {/* Passo 2 */}
            <Card className="rounded-2xl border-slate-200 shadow-xs relative overflow-hidden">
              <div className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-[#0FA3A3]">
                2
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#1A2333]">
                  Descompactar a Pasta
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Extração no computador
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-[#475569]">
                <p>
                  Extraia o arquivo ZIP para uma pasta fixa no seu computador (por exemplo:{' '}
                  <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] text-slate-800">
                    Documentos/rumo-extensao
                  </code>
                  ).
                </p>
                <p className="text-[11px] text-[#94A3B8]">
                  Não exclua esta pasta após instalar para o Chrome manter os arquivos ativos.
                </p>
              </CardContent>
            </Card>

            {/* Passo 3 */}
            <Card className="rounded-2xl border-slate-200 shadow-xs relative overflow-hidden">
              <div className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-[#0FA3A3]">
                3
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#1A2333]">
                  chrome://extensions
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Modo do desenvolvedor
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-[#475569]">
                <p>
                  No Chrome, abra a barra de endereços e digite{' '}
                  <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] text-teal-700 font-bold">
                    chrome://extensions
                  </code>
                  .
                </p>
                <p>
                  No canto superior direito, ative a chave <strong>"Modo do desenvolvedor"</strong>.
                </p>
              </CardContent>
            </Card>

            {/* Passo 4 */}
            <Card className="rounded-2xl border-slate-200 shadow-xs relative overflow-hidden">
              <div className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-[#0FA3A3]">
                4
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-[#1A2333]">
                  Carregar no Chrome
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Instalação sem compactação
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-[#475569]">
                <p>
                  Clique no botão <strong>"Carregar sem compactação"</strong> e selecione a pasta
                  extraída.
                </p>
                <p className="text-[#0FA3A3] font-semibold">
                  Pronto! Abra o WhatsApp Web e você verá o botão flutuante da Rumo.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* O que a extensão faz vs O que não faz */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="rounded-2xl border-emerald-200 bg-emerald-50/30 shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-600" />
                  <CardTitle className="text-sm font-bold text-emerald-950">
                    O que a extensão Rumo FAZ
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-emerald-900 space-y-2.5">
                <div className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                  <span>
                    <strong>Templates Contábeis Pré-formatados:</strong> Preenche mensagens de
                    cobrança, boas-vindas e prazos com substituição instantânea de tags como nome do
                    cliente, empresa, valor e vencimento.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                  <span>
                    <strong>Envio Assistivo de Documentos:</strong> Permite escolher recibos,
                    balancetes e contratos sociais para gerar os textos oficiais de envio e
                    facilitar os anexos.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                  <span>
                    <strong>Captura de Contato e Criação de Empresa:</strong> Lê o contato ou
                    telefone da conversa ativa e cadastra na Rumo com 1 clique para pré-cadastro de
                    novas empresas e clientes.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                  <span>
                    <strong>Painel Flutuante Integrado:</strong> Interface elegante em Tailwind dark
                    que abre no canto inferior direito do WhatsApp Web sem atrapalhar a conversa.
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-rose-200 bg-rose-50/30 shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-rose-600" />
                  <CardTitle className="text-sm font-bold text-rose-950">
                    O que a extensão NUNCA FAZ (Segurança Anti-Ban)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-rose-900 space-y-2.5">
                <div className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                  <span>
                    <strong>NUNCA clica no botão Enviar automaticamente:</strong> O operador
                    contábil é quem sempre revisa o texto pré-preenchido e confirma o clique de
                    envio.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                  <span>
                    <strong>NÃO faz envios automatizados em lote ou SPAM:</strong> Evita banimentos
                    permanentes de contas do WhatsApp comercial do escritório.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                  <span>
                    <strong>NÃO lê mensagens privadas de outras conversas:</strong> O script só atua
                    no chat aberto quando o operador clica para acionar o assistente.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                  <span>
                    <strong>Totalmente isolada e protegida:</strong> Credenciais ficam armazenadas
                    apenas no storage local do seu navegador Google Chrome.
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: TOKEN & CONEXÃO */}
        <TabsContent value="conexao" className="space-y-6">
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold text-[#1A2333]">
                Credenciais de Conexão da Sessão Atual
              </CardTitle>
              <CardDescription className="text-xs text-[#64748B]">
                Copie os dados abaixo e cole no popup da extensão Rumo no Google Chrome para
                sincronizar com sua conta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* URL da Plataforma */}
              <div className="space-y-1.5">
                <Label className="text-xs text-[#64748B] uppercase font-bold">
                  1. URL da Plataforma
                </Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={currentPlatformUrl}
                    className="h-9 text-xs bg-slate-50 border-slate-200 font-mono"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyUrl}
                    className="h-9 border-slate-200 text-xs gap-1.5 shrink-0"
                  >
                    {copiedUrl ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copiedUrl ? 'Copiado!' : 'Copiar URL'}
                  </Button>
                </div>
              </div>

              {/* Token de Sessão */}
              <div className="space-y-1.5">
                <Label className="text-xs text-[#64748B] uppercase font-bold">
                  2. Token de Conexão do Usuário ({user?.name || user?.email})
                </Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    type="password"
                    value={currentToken || 'Sessão não autenticada'}
                    className="h-9 text-xs bg-slate-50 border-slate-200 font-mono"
                  />
                  <Button
                    size="sm"
                    onClick={handleCopyToken}
                    className="h-9 bg-[#0FA3A3] hover:bg-[#0d8c8c] text-white text-xs gap-1.5 shrink-0"
                  >
                    {copiedToken ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copiedToken ? 'Copiado!' : 'Copiar Token'}
                  </Button>
                </div>
                <p className="text-[11px] text-[#94A3B8]">
                  Aviso de Segurança: Nunca compartilhe este token com terceiros. Ele permite que a
                  extensão salve os contatos capturados no seu escritório.
                </p>
              </div>

              {/* Status do Escritório */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[#64748B]">Escritório Conectado: </span>
                  <strong className="text-[#1A2333]">{tenant?.nome}</strong>
                </div>
                <Badge
                  variant="outline"
                  className="text-[11px] bg-white text-[#0FA3A3] border-teal-200"
                >
                  Tenant Ativo
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: SIMULADOR & TEMPLATES */}
        <TabsContent value="simulador" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Controles de Simulação */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="rounded-2xl border-slate-200 shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-[#1A2333]">
                    Parâmetros do Chat Ativo
                  </CardTitle>
                  <CardDescription className="text-xs text-[#64748B]">
                    Dados capturados da conversa do WhatsApp Web para preenchimento das variáveis
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-[#64748B]">Contato da Conversa</Label>
                    <Input
                      value={simContato}
                      onChange={(e) => setSimContato(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-[#64748B]">Empresa Referência</Label>
                    <Input
                      value={simEmpresa}
                      onChange={(e) => setSimEmpresa(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-[#64748B]">Valor (R$)</Label>
                      <Input
                        value={simValor}
                        onChange={(e) => setSimValor(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-[#64748B]">Vencimento</Label>
                      <Input
                        value={simVencimento}
                        onChange={(e) => setSimVencimento(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-[#64748B]">Modelo de Mensagem Rápida</Label>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {templates.map((tpl) => (
                        <div
                          key={tpl.id}
                          onClick={() => setSimSelectedTemplate(tpl.id)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                            simSelectedTemplate === tpl.id
                              ? 'border-[#0FA3A3] bg-teal-50/50 font-medium text-[#0B1F3A]'
                              : 'border-slate-200 hover:bg-slate-50 text-[#475569]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs text-[#1A2333]">
                              {tpl.titulo}
                            </span>
                            <Badge variant="outline" className="text-[9px] uppercase">
                              {tpl.categoria}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-[#64748B] line-clamp-2">{tpl.conteudo}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pré-visualização da Caixa de Texto do WhatsApp Web */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="rounded-2xl border-slate-200 shadow-xs flex flex-col justify-between">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-emerald-500" />
                      <CardTitle className="text-sm font-bold text-[#1A2333]">
                        Simulação da Caixa de Texto do WhatsApp Web
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-[#0FA3A3] border-teal-200">
                      Modo Assistivo
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-[#64748B]">
                    Exibe como a mensagem é renderizada pronta para envio pelo operador humano
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-4 space-y-4 flex-1">
                  <div className="rounded-xl border border-slate-200 bg-[#EFEAE2] p-4 text-xs text-slate-800 font-sans shadow-inner relative min-h-[160px] flex flex-col justify-end">
                    <div className="self-end max-w-[85%] rounded-lg bg-[#D9FDD3] p-3 text-xs shadow-xs text-[#111B21] leading-relaxed whitespace-pre-wrap">
                      {simPreviewTexto || 'Selecione um template ao lado para visualizar a prévia.'}
                      <div className="text-[9px] text-slate-400 text-right mt-1.5 flex items-center justify-end gap-1">
                        <span>14:32</span>
                        <Check className="h-3 w-3 text-emerald-600" />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 text-xs text-[#0B1F3A] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-[#0FA3A3] shrink-0" />
                      <span>
                        A extensão injeta o texto com foco na conversa. O operador contábil revisa e
                        clica no ícone de envio do WhatsApp.
                      </span>
                    </div>
                  </div>
                </CardContent>

                <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
                  <Button
                    onClick={handleSimularPreenchimentoWhatsApp}
                    className="bg-[#0FA3A3] hover:bg-[#0d8c8c] text-white text-xs gap-2"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {simEnviadoWhatsApp
                      ? 'Texto Injetado no WhatsApp!'
                      : 'Testar Pré-preenchimento no WhatsApp'}
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: CONTATOS CAPTURADOS */}
        <TabsContent value="leads" className="space-y-6">
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-[#1A2333]">
                  Contatos e Leads Capturados no WhatsApp Web
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Contatos extraídos da conversa ativa pela extensão, prontos para virar novas
                  empresas ou serem associados
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loadingData}
                className="h-8 border-slate-200 text-xs gap-1.5"
              >
                <RefreshCw className={`h-3 w-3 ${loadingData ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </CardHeader>

            <CardContent>
              {leads.length === 0 ? (
                <div className="text-center py-10 rounded-xl border border-dashed border-slate-200 p-6">
                  <UserPlus className="h-8 w-8 text-[#94A3B8] mx-auto mb-2" />
                  <p className="text-xs font-semibold text-[#1A2333]">
                    Nenhum contato capturado ainda
                  </p>
                  <p className="text-xs text-[#64748B] max-w-sm mx-auto mt-1">
                    Instale a extensão, abra uma conversa no WhatsApp Web e use a aba "Capturar
                    Contato" para salvar os dados aqui.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-[#64748B] uppercase text-[10px] border-y border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Contato</th>
                        <th className="py-2.5 px-3">Telefone</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Empresa Vinculada</th>
                        <th className="py-2.5 px-3">Data Captura</th>
                        <th className="py-2.5 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[#334155]">
                      {leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 font-semibold text-[#1A2333]">
                            {lead.nome_contato}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-[#64748B]">
                            {lead.telefone}
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] capitalize ${
                                lead.status_captura === 'empresa_criada' ||
                                lead.status_captura === 'empresa_vinculada'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {lead.status_captura.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-3 px-3">
                            {lead.expand?.empresa_associada ? (
                              <span className="font-medium text-[#0FA3A3]">
                                {lead.expand.empresa_associada.razao_social}
                              </span>
                            ) : (
                              <span className="text-[#94A3B8] italic">Não vinculada</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-[#64748B]">
                            {new Date(lead.created).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {!lead.empresa_associada && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAbrirModalCriarEmpresa(lead)}
                                className="h-7 text-[11px] border-slate-200 text-[#0FA3A3] hover:bg-teal-50"
                              >
                                <Building2 className="mr-1 h-3 w-3" />
                                Criar Empresa
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: CRIAR EMPRESA A PARTIR DE LEAD CAPTURADO */}
      <Dialog open={modalCriarEmpresaOpen} onOpenChange={setModalCriarEmpresaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333]">
              Criar Nova Empresa pelo Contato do WhatsApp
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Os dados capturados da conversa ativa serão aproveitados no pré-cadastro da empresa na
              Rumo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-[#64748B]">Razão Social / Nome da Empresa</Label>
              <Input
                value={novaRazaoSocial}
                onChange={(e) => setNovaRazaoSocial(e.target.value)}
                placeholder="Ex: Mendes Serviços Médicos LTDA"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-[#64748B]">CNPJ (Opcional ou a definir)</Label>
              <Input
                value={novoCnpj}
                onChange={(e) => setNovoCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="h-9 text-xs"
              />
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-[#475569] space-y-1">
              <div>
                <span className="text-[#64748B]">Contato Responsável: </span>
                <strong className="text-[#1A2333]">{leadParaCriarEmpresa?.nome_contato}</strong>
              </div>
              <div>
                <span className="text-[#64748B]">WhatsApp: </span>
                <span className="font-mono text-slate-700">{leadParaCriarEmpresa?.telefone}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalCriarEmpresaOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSalvarEmpresaDoLead}
              disabled={salvandoEmpresa || !novaRazaoSocial.trim()}
              className="bg-[#0FA3A3] hover:bg-[#0d8c8c] text-white text-xs"
            >
              {salvandoEmpresa ? 'Cadastrando...' : 'Confirmar e Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

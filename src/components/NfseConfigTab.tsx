import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Copy,
  Check,
  RefreshCw,
  Key,
  Globe,
  Radio,
  Sparkles,
  Info,
  Loader2,
  CheckCircle2,
  XCircle,
  Building,
  ShieldCheck,
  Server,
  ExternalLink,
  AlertCircle,
  SlidersHorizontal,
  Send,
  QrCode,
} from 'lucide-react'
import type {
  NfseConfigRecord,
  Empresa,
  ProvedorFiscalTipo,
  ProvedorAmbiente,
  ProvedorEmpresaConfig,
} from '@/types'
import { nfseWhatsappService } from '@/services/nfseWhatsapp'
import { FiscalAdapterFactory } from '@/services/fiscalAdapters'
import { useToast } from '@/hooks/use-toast'
import { maskCnpj } from '@/lib/formatters'

interface NfseConfigTabProps {
  config: NfseConfigRecord | null
  empresas: Empresa[]
  tenantId: string
  onRefresh: () => void
  currentUserId?: string
  canEdit: boolean
}

export const NfseConfigTab: React.FC<NfseConfigTabProps> = ({
  config,
  empresas,
  tenantId,
  onRefresh,
  currentUserId,
  canEdit,
}) => {
  const { toast } = useToast()

  const [empresaPadrao, setEmpresaPadrao] = useState<string>(config?.empresa_padrao || '')
  const [evolutionUrl, setEvolutionUrl] = useState<string>(config?.evolution_api_url || '')
  const [evolutionKey, setEvolutionKey] = useState<string>(config?.evolution_api_key || '')
  const [evolutionInstance, setEvolutionInstance] = useState<string>(
    config?.evolution_instance || '',
  )
  const [modoOperacao, setModoOperacao] = useState<'simulacao' | 'producao'>(
    config?.modo_operacao || 'simulacao',
  )
  const [autoAprovar, setAutoAprovar] = useState<boolean>(
    config?.auto_aprovar_alta_confianca || false,
  )
  const [ativo, setAtivo] = useState<boolean>(config?.ativo ?? true)
  const [telefoneSuporte, setTelefoneSuporte] = useState<string>(config?.telefone_suporte || '')

  // Provedores Fiscais Gerais (Tenant)
  const [provedorFiscal, setProvedorFiscal] = useState<ProvedorFiscalTipo>(
    config?.provedor_fiscal || 'governacional',
  )
  const [provedorAmbiente, setProvedorAmbiente] = useState<ProvedorAmbiente>(
    config?.provedor_ambiente || 'producao',
  )
  const [govbrClientId, setGovbrClientId] = useState<string>(config?.govbr_client_id || '')
  const [govbrClientSecret, setGovbrClientSecret] = useState<string>(
    config?.govbr_client_secret || '',
  )
  const [govbrApiUrl, setGovbrApiUrl] = useState<string>(
    config?.govbr_api_url || 'https://nfse.receita.fazenda.gov.br/portalnfse',
  )
  const [municipioIbge, setMunicipioIbge] = useState<string>(
    config?.provedor_municipio_ibge || '3550308',
  )

  // Credenciais Betha Gerais
  const [bethaUsuario, setBethaUsuario] = useState<string>(config?.betha_usuario || '')
  const [bethaSenhaToken, setBethaSenhaToken] = useState<string>(config?.betha_senha_token || '')
  const [bethaApiUrl, setBethaApiUrl] = useState<string>(
    config?.betha_api_url || 'https://e-gov.betha.com.br/e-nota-contribuinte-ws/nfseWS',
  )

  // Credenciais Ginfes Gerais
  const [ginfesUsuario, setGinfesUsuario] = useState<string>(config?.ginfes_usuario || '')
  const [ginfesSenha, setGinfesSenha] = useState<string>(config?.ginfes_senha || '')
  const [ginfesApiUrl, setGinfesApiUrl] = useState<string>(
    config?.ginfes_api_url || 'https://homologacao.ginfes.com.br/ServiceGinfesImpl',
  )

  // Configuração por Empresa (Override Individual)
  const [empresaSelecionadaConfig, setEmpresaSelecionadaConfig] = useState<string>(
    empresas.length > 0 ? empresas[0].id : '',
  )
  const [temCertificadoNfse, setTemCertificadoNfse] = useState<boolean>(false)

  useEffect(() => {
    const checarCert = async () => {
      if (!empresaSelecionadaConfig) {
        setTemCertificadoNfse(false)
        return
      }
      try {
        const certs = await pb.collection('certificados_digitais').getFullList({
          filter: `empresa = "${empresaSelecionadaConfig}" && status = "ativo"`,
        })
        setTemCertificadoNfse(certs.length > 0)
      } catch {
        setTemCertificadoNfse(false)
      }
    }
    checarCert()
  }, [empresaSelecionadaConfig])
  const [provedoresEmpresas, setProvedoresEmpresas] = useState<
    Record<string, ProvedorEmpresaConfig>
  >(config?.provedores_empresas_json || {})

  // Mensagens
  const [msgSaudacao, setMsgSaudacao] = useState<string>(config?.msg_saudacao || '')
  const [msgRecebimento, setMsgRecebimento] = useState<string>(config?.msg_recebimento || '')
  const [msgAprovacao, setMsgAprovacao] = useState<string>(config?.msg_aprovacao || '')
  const [msgRejeicao, setMsgRejeicao] = useState<string>(config?.msg_rejeicao || '')
  const [msgNotaEmitida, setMsgNotaEmitida] = useState<string>(config?.msg_nota_emitida || '')
  const [prazoDiasCancelamento, setPrazoDiasCancelamento] = useState<number>(
    config?.prazo_dias_cancelamento || 30,
  )

  // Configuração padrão de PIX para cobrança
  const [chavePixPadrao, setChavePixPadrao] = useState<string>(config?.chave_pix_padrao || '')
  const [beneficiarioPadrao, setBeneficiarioPadrao] = useState<string>(
    config?.beneficiario_padrao || '',
  )

  const [salvando, setSalvando] = useState(false)
  const [testandoEvo, setTestandoEvo] = useState(false)
  const [resultadoTesteEvo, setResultadoTesteEvo] = useState<{
    sucesso: boolean
    status:
      | 'conectada'
      | 'instancia_nao_encontrada'
      | 'falha_autenticacao'
      | 'url_inalcancavel'
      | 'incompleta'
    mensagem: string
    detalhe?: string
  } | null>(null)

  // Envio de mensagem de teste real via Evolution API
  const [numeroTesteWa, setNumeroTesteWa] = useState<string>('')
  const [disparandoTesteWa, setDisparandoTesteWa] = useState(false)
  const [resultadoDisparoTeste, setResultadoDisparoTeste] = useState<{
    sucesso: boolean
    status: string
    mensagem: string
  } | null>(null)

  const [testandoProvedor, setTestandoProvedor] = useState(false)
  const [resultadoTesteProvedor, setResultadoTesteProvedor] = useState<{
    sucesso: boolean
    mensagem: string
    statusCode?: number
    detalhe?: string
  } | null>(null)

  const [copiado, setCopiado] = useState(false)

  // URL do webhook montada para Evolution API
  const backendBaseUrl =
    import.meta.env.VITE_POCKETBASE_URL ||
    'https://plataforma-contabil-saas-091ba.shrd00.internal.goskip.dev'
  const webhookUrlCompleta = `${backendBaseUrl}/backend/v1/nfse/webhook/${config?.webhook_token || 'TOKEN'}`

  const handleCopiarWebhook = () => {
    navigator.clipboard.writeText(webhookUrlCompleta)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
    toast({
      title: 'URL copiada!',
      description: 'URL do Webhook copiada para a área de transferência.',
    })
  }

  // Manipulação de configuração específica de uma empresa selecionada
  const empAtualConfig: ProvedorEmpresaConfig = provedoresEmpresas[empresaSelecionadaConfig] || {
    provedor: provedorFiscal,
    ambiente: provedorAmbiente,
    municipioIbge: municipioIbge,
    apiUrl: '',
    clientId: '',
    clientSecret: '',
    usuario: '',
    senhaToken: '',
    senha: '',
  }

  const handleUpdateEmpresaConfig = (campo: keyof ProvedorEmpresaConfig, valor: string) => {
    if (!empresaSelecionadaConfig) return
    setProvedoresEmpresas((prev) => ({
      ...prev,
      [empresaSelecionadaConfig]: {
        ...(prev[empresaSelecionadaConfig] || {
          provedor: provedorFiscal,
          ambiente: provedorAmbiente,
          municipioIbge: municipioIbge,
        }),
        [campo]: valor,
      },
    }))
  }

  const handleSalvar = async () => {
    if (!config) return
    setSalvando(true)
    try {
      await nfseWhatsappService.saveConfig(
        tenantId,
        config.id,
        {
          empresa_padrao: empresaPadrao || undefined,
          evolution_api_url: evolutionUrl.trim(),
          evolution_api_key: evolutionKey.trim(),
          evolution_instance: evolutionInstance.trim(),
          chave_pix_padrao: chavePixPadrao.trim(),
          beneficiario_padrao: beneficiarioPadrao.trim(),
          modo_operacao: modoOperacao,
          auto_aprovar_alta_confianca: autoAprovar,
          provedor_fiscal: provedorFiscal,
          provedor_ambiente: provedorAmbiente,
          govbr_client_id: govbrClientId.trim(),
          govbr_client_secret: govbrClientSecret.trim(),
          govbr_api_url: govbrApiUrl.trim(),
          provedor_municipio_ibge: municipioIbge.trim(),
          betha_usuario: bethaUsuario.trim(),
          betha_senha_token: bethaSenhaToken.trim(),
          betha_api_url: bethaApiUrl.trim(),
          ginfes_usuario: ginfesUsuario.trim(),
          ginfes_senha: ginfesSenha.trim(),
          ginfes_api_url: ginfesApiUrl.trim(),
          provedores_empresas_json: provedoresEmpresas,
          msg_saudacao: msgSaudacao.trim(),
          msg_recebimento: msgRecebimento.trim(),
          msg_aprovacao: msgAprovacao.trim(),
          msg_rejeicao: msgRejeicao.trim(),
          msg_nota_emitida: msgNotaEmitida.trim(),
          telefone_suporte: telefoneSuporte.trim(),
          prazo_dias_cancelamento: prazoDiasCancelamento,
          ativo,
        },
        currentUserId,
      )

      toast({
        title: 'Configurações salvas!',
        description:
          'Os parâmetros do canal WhatsApp e provedores fiscais (Gov.br / Betha / Ginfes) foram atualizados.',
      })
      onRefresh()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Erro ao salvar',
        description: errMsg,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleTestarEvolution = async () => {
    setTestandoEvo(true)
    setResultadoTesteEvo(null)
    try {
      const res = await nfseWhatsappService.testarConexaoEvolution(
        evolutionUrl,
        evolutionKey,
        evolutionInstance,
      )
      setResultadoTesteEvo(res)
      if (res.sucesso) {
        toast({
          title: 'Conexão estabelecida com sucesso!',
          description: res.mensagem,
        })
      } else {
        toast({
          title: 'Resultado do teste com a Evolution API',
          description: res.mensagem,
          variant: res.status === 'falha_autenticacao' ? 'destructive' : 'default',
        })
      }
    } finally {
      setTestandoEvo(false)
    }
  }

  const handleDispararMensagemTeste = async () => {
    const rawNum = numeroTesteWa.replace(/\D/g, '')
    if (rawNum.length < 10) {
      toast({
        title: 'Número inválido',
        description: 'Digite o número do WhatsApp com DDD (ex: 41999998888 ou 11988887777).',
        variant: 'destructive',
      })
      return
    }

    const empId = empresaPadrao || (empresas.length > 0 ? empresas[0].id : '')
    if (!empId) {
      toast({
        title: 'Empresa necessária',
        description: 'Selecione uma empresa prestadora padrão para associar ao registro de teste.',
        variant: 'destructive',
      })
      return
    }

    setDisparandoTesteWa(true)
    setResultadoDisparoTeste(null)
    try {
      const resp = await whatsappAtivoService.dispararEnvio({
        tenant_id: tenantId,
        empresa_id: empId,
        tipo: 'teste',
        referencia: 'teste_conexao_painel',
        destinatario: rawNum,
        mensagem:
          '🔔 *TESTE DE INTEGRAÇÃO - RUMO CONTÁBIL*\n\n' +
          'Esta é uma mensagem de teste enviada pela Plataforma Contábil SaaS via Evolution API.\n\n' +
          `• *Instância:* ${evolutionInstance || 'não identificada'}\n` +
          `• *Data/Hora:* ${new Date().toLocaleString('pt-BR')}\n\n` +
          'Se você recebeu esta notificação, a integração com o WhatsApp está operando normalmente!',
        origem: 'manual',
      })

      setResultadoDisparoTeste({
        sucesso: resp.sucesso,
        status: resp.status,
        mensagem: resp.mensagem || 'Mensagem processada.',
      })

      if (resp.status === 'enviado') {
        toast({
          title: 'Mensagem de teste enviada!',
          description: 'A mensagem real foi transmitida para o WhatsApp com sucesso.',
        })
      } else if (resp.status === 'aguardando_credenciais') {
        toast({
          title: 'Modo Supervisão (Sem credenciais)',
          description:
            'A mensagem foi gravada na fila com status "aguardando_credenciais". Configure URL pública, API Key e Instância para envio externo real.',
        })
      } else {
        toast({
          title: 'Falha no envio',
          description: resp.erro || 'Não foi possível transmitir a mensagem.',
          variant: 'destructive',
        })
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setResultadoDisparoTeste({
        sucesso: false,
        status: 'falhou',
        mensagem: errMsg,
      })
      toast({
        title: 'Erro ao disparar teste',
        description: errMsg,
        variant: 'destructive',
      })
    } finally {
      setDisparandoTesteWa(false)
    }
  }

  const handleTestarProvedorFiscal = async (
    provedorAlvo?: ProvedorFiscalTipo,
    empresaIdAlvo?: string,
  ) => {
    setTestandoProvedor(true)
    setResultadoTesteProvedor(null)
    const prov = provedorAlvo || provedorFiscal
    const empId = empresaIdAlvo || empresaSelecionadaConfig || empresaPadrao
    const confEmp = empId ? provedoresEmpresas[empId] : undefined

    let apiUrl = confEmp?.apiUrl
    let clientId = confEmp?.clientId || govbrClientId
    let clientSecret = confEmp?.clientSecret || govbrClientSecret
    let usuario = confEmp?.usuario
    let senhaToken = confEmp?.senhaToken
    let senha = confEmp?.senha
    const codIbge = confEmp?.municipioIbge || municipioIbge

    if (prov === 'governacional') {
      apiUrl = apiUrl || govbrApiUrl
    } else if (prov === 'betha') {
      apiUrl = apiUrl || bethaApiUrl
      usuario = usuario || bethaUsuario
      senhaToken = senhaToken || bethaSenhaToken
    } else if (prov === 'ginfes') {
      apiUrl = apiUrl || ginfesApiUrl
      usuario = usuario || ginfesUsuario
      senha = senha || ginfesSenha
    }

    try {
      const res = await nfseWhatsappService.testarConexaoProvedor({
        tenantId,
        provedor: prov,
        apiUrl,
        clientId,
        clientSecret,
        usuario,
        senhaToken,
        senha,
        municipioIbge: codIbge,
        empresaId: empId,
      })

      setResultadoTesteProvedor(res)
      if (res.sucesso) {
        toast({
          title: `Conexão com Provedor Fiscal (${prov.toUpperCase()}) confirmada!`,
          description: res.mensagem,
        })
      } else {
        toast({
          title: `Teste com ${prov.toUpperCase()}`,
          description: res.mensagem,
          variant:
            res.mensagem.includes('incompletas') || res.mensagem.includes('ausentes')
              ? 'default'
              : 'destructive',
        })
      }
    } finally {
      setTestandoProvedor(false)
    }
  }

  const temCredenciaisGovbr = !!(govbrClientId.trim() && govbrClientSecret.trim())
  const temCredenciaisBetha = !!(bethaUsuario.trim() && bethaSenhaToken.trim())
  const temCredenciaisGinfes = !!ginfesUsuario.trim()

  const adapters = FiscalAdapterFactory.listAdapters()

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Banner de Arquitetura e Transparência */}
      <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-transparent p-5 shadow-xs space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0FA3A3] text-white">
            <Radio className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#1A2333]">
                Arquitetura do Canal WhatsApp & Adapters Fiscais de NFS-e
              </h3>
              <Badge
                className={
                  modoOperacao === 'producao'
                    ? 'bg-emerald-600 text-white text-[10px]'
                    : 'bg-amber-600 text-white text-[10px]'
                }
              >
                {modoOperacao === 'producao' ? 'MODO PRODUÇÃO' : 'MODO SIMULAÇÃO CONTROLADA'}
              </Badge>
            </div>
            <p className="text-xs text-[#475569] leading-relaxed">
              O módulo conecta a <strong>Evolution API</strong> (WhatsApp real) ao{' '}
              <strong>Motor Cognitivo IA</strong>, ao <strong>Painel de Supervisão</strong> e à{' '}
              <strong>Fábrica de Adapters Fiscais (Gov.br, Betha Sistemas e Ginfes)</strong>. A
              escolha do provedor pode ser ajustada globalmente ou por empresa/município.
            </p>
          </div>
        </div>

        {/* Banner honesto sobre credenciais de emissão e fallback */}
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900">
          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong>Honestidade da Integração Fiscal & Validação Local ABRASF:</strong>
            <p className="text-[11px] text-blue-800 leading-normal">
              Os adapters <strong>Gov.br</strong>, <strong>Betha Sistemas</strong> e{' '}
              <strong>Ginfes</strong> estão totalmente implementados e ativos. Quando a empresa
              possui credenciais e certificado A1, a emissão é transmitida via HTTP/SOAP real. Sem
              credenciais cadastradas, o sistema executa a validação estrutural ABRASF local e opera
              em <strong>Modo Simulação Controlada</strong> com geração de XML, número sequencial e
              DANFSE oficial, sem cobrança indevida na prefeitura.
            </p>
          </div>
        </div>
      </div>

      {/* Card 1: Conector Provedor Fiscal por Empresa e Global (FRENTE 1) */}
      <Card className="rounded-2xl border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-[#0FA3A3]" />
              1. Provedores Fiscais de NFS-e (Gov.br / Betha / Ginfes — Ativos)
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className="text-[10px] border-teal-300 bg-teal-50 text-teal-800"
              >
                3 Provedores Ativos
              </Badge>
            </div>
          </CardTitle>
          <CardDescription className="text-xs text-[#64748B]">
            Configure o provedor padrão do escritório ou personalize o provedor específico por
            empresa conforme o município da sua carteira (ex: São Paulo via Gov.br, Curitiba via
            Betha, Campinas via Ginfes).
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-6">
          {/* Seletor de Empresa para Parametrização Individual */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#1A2333] flex items-center gap-1.5">
                  <SlidersHorizontal className="h-4 w-4 text-[#0FA3A3]" />
                  Configuração Fiscal por Empresa da Carteira
                </span>
                {temCertificadoNfse && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px] font-bold">
                    Certificado A1 vinculado à empresa
                  </Badge>
                )}
              </div>
              <span className="text-[10px] text-[#64748B]">
                Permite plugar Betha, Ginfes ou Gov.br por município
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5 md:col-span-1">
                <Label className="text-xs font-medium text-[#1A2333]">Empresa a Parametrizar</Label>
                <Select
                  value={empresaSelecionadaConfig}
                  onValueChange={setEmpresaSelecionadaConfig}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Selecione uma empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.razao_social} ({emp.cidade || '—'}/{emp.uf || '—'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 md:col-span-1">
                <Label className="text-xs font-medium text-[#1A2333]">
                  Provedor da Empresa ({empresaMapNome(empresas, empresaSelecionadaConfig)})
                </Label>
                <Select
                  value={empAtualConfig.provedor || 'governacional'}
                  onValueChange={(val: ProvedorFiscalTipo) =>
                    handleUpdateEmpresaConfig('provedor', val)
                  }
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {adapters.map((ad) => (
                      <SelectItem key={ad.id} value={ad.id} className="text-xs">
                        {ad.nome} (Ativo)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 md:col-span-1">
                <Label className="text-xs font-medium text-[#1A2333]">
                  Código IBGE do Município
                </Label>
                <Input
                  value={empAtualConfig.municipioIbge || ''}
                  onChange={(e) => handleUpdateEmpresaConfig('municipioIbge', e.target.value)}
                  placeholder="Ex: 4106902 (Curitiba) ou 3509502 (Campinas)"
                  className="h-9 text-xs bg-white font-mono"
                  disabled={!canEdit}
                />
              </div>
            </div>

            {/* Painel dinâmico de credenciais da empresa selecionada */}
            <div className="pt-2 border-t border-slate-200">
              {empAtualConfig.provedor === 'governacional' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-[#1A2333]">
                      Client ID Gov.br (Opcional por empresa)
                    </Label>
                    <Input
                      value={empAtualConfig.clientId || ''}
                      onChange={(e) => handleUpdateEmpresaConfig('clientId', e.target.value)}
                      placeholder="Padrão do tenant ou específico desta empresa"
                      className="h-8 text-xs bg-white"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-[#1A2333]">
                      Client Secret Gov.br
                    </Label>
                    <Input
                      type="password"
                      value={empAtualConfig.clientSecret || ''}
                      onChange={(e) => handleUpdateEmpresaConfig('clientSecret', e.target.value)}
                      placeholder="••••••••••••••••••••"
                      className="h-8 text-xs bg-white"
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              )}

              {empAtualConfig.provedor === 'betha' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#1A2333]">
                    <ShieldCheck className="h-4 w-4 text-[#0FA3A3]" />
                    Parâmetros do Webservice Betha Sistemas (ABRASF 2.x)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-[#1A2333]">
                        Usuário / Login Betha
                      </Label>
                      <Input
                        value={empAtualConfig.usuario || ''}
                        onChange={(e) => handleUpdateEmpresaConfig('usuario', e.target.value)}
                        placeholder="Ex: betha_graos_sul"
                        className="h-8 text-xs bg-white"
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-[#1A2333]">
                        Token de Acesso / Senha
                      </Label>
                      <Input
                        type="password"
                        value={empAtualConfig.senhaToken || ''}
                        onChange={(e) => handleUpdateEmpresaConfig('senhaToken', e.target.value)}
                        placeholder="••••••••••••••••••••"
                        className="h-8 text-xs bg-white"
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-[#1A2333]">
                        Endpoint Webservice Betha
                      </Label>
                      <Input
                        value={
                          empAtualConfig.apiUrl ||
                          'https://e-gov.betha.com.br/e-nota-contribuinte-ws/nfseWS'
                        }
                        onChange={(e) => handleUpdateEmpresaConfig('apiUrl', e.target.value)}
                        className="h-8 text-xs bg-white font-mono"
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                </div>
              )}

              {empAtualConfig.provedor === 'ginfes' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#1A2333]">
                    <ShieldCheck className="h-4 w-4 text-[#0FA3A3]" />
                    Parâmetros do Webservice Ginfes (ABRASF SOAP)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-[#1A2333]">
                        Usuário / CNPJ Ginfes
                      </Label>
                      <Input
                        value={empAtualConfig.usuario || ''}
                        onChange={(e) => handleUpdateEmpresaConfig('usuario', e.target.value)}
                        placeholder="Ex: ginfes_logprime"
                        className="h-8 text-xs bg-white"
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-[#1A2333]">
                        Senha de Acesso Webservice
                      </Label>
                      <Input
                        type="password"
                        value={empAtualConfig.senha || ''}
                        onChange={(e) => handleUpdateEmpresaConfig('senha', e.target.value)}
                        placeholder="••••••••••••••••••••"
                        className="h-8 text-xs bg-white"
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-[#1A2333]">
                        Endpoint Service Ginfes
                      </Label>
                      <Input
                        value={
                          empAtualConfig.apiUrl ||
                          'https://homologacao.ginfes.com.br/ServiceGinfesImpl'
                        }
                        onChange={(e) => handleUpdateEmpresaConfig('apiUrl', e.target.value)}
                        className="h-8 text-xs bg-white font-mono"
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Ação rápida de testar conexão para a empresa selecionada */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleTestarProvedorFiscal(empAtualConfig.provedor, empresaSelecionadaConfig)
                }
                disabled={testandoProvedor || !canEdit}
                className="text-xs gap-1.5 h-8 bg-white"
              >
                {testandoProvedor ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Testando {empAtualConfig.provedor?.toUpperCase()}...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Testar Conexão desta Empresa ({empAtualConfig.provedor?.toUpperCase()})
                  </>
                )}
              </Button>
              <span className="text-[10px] text-[#64748B]">
                Handshake no webservice com validação do certificado A1 vinculado.
              </span>
            </div>
          </div>

          {/* Configuração Padrão do Escritório (Fallback Geral) */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#1A2333] uppercase tracking-wider flex items-center gap-1.5">
              <Building className="h-4 w-4 text-[#0FA3A3]" />
              Provedor Padrão do Escritório (Fallback Geral)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A2333]">
                  Provedor Padrão do Tenant
                </Label>
                <Select
                  value={provedorFiscal}
                  onValueChange={(val: ProvedorFiscalTipo) => setProvedorFiscal(val)}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {adapters.map((ad) => (
                      <SelectItem key={ad.id} value={ad.id} className="text-xs">
                        {ad.nome} (Ativo)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-[#64748B]">
                  Utilizado para empresas que não possuem override específico configurado.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A2333]">Ambiente de Emissão</Label>
                <Select
                  value={provedorAmbiente}
                  onValueChange={(val: ProvedorAmbiente) => setProvedorAmbiente(val)}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="producao" className="text-xs">
                      Produção Oficial (Com Valor Fiscal)
                    </SelectItem>
                    <SelectItem value="homologacao" className="text-xs">
                      Homologação (Ambiente de Testes)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-[#64748B]">
                  Em produção, as notas são protocoladas na base da Receita Federal / Município.
                </p>
              </div>
            </div>

            {/* Credenciais Globais Gov.br */}
            {provedorFiscal === 'governacional' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1A2333] flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#0FA3A3]" />
                    Credenciais Globais API Gov.br (Emissor Nacional)
                  </span>
                  <span className="text-[10px] text-[#64748B]">
                    Autenticação via Certificado e-CNPJ A1 + Chaves de API
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-[#1A2333]">
                      Client ID / Chave da Aplicação Gov.br
                    </Label>
                    <Input
                      value={govbrClientId}
                      onChange={(e) => setGovbrClientId(e.target.value)}
                      placeholder="Ex: gov_live_7m1e0poGF..."
                      className="h-8 text-xs bg-white"
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-[#1A2333]">
                      Client Secret / Senha de API Gov.br
                    </Label>
                    <Input
                      type="password"
                      value={govbrClientSecret}
                      onChange={(e) => setGovbrClientSecret(e.target.value)}
                      placeholder="••••••••••••••••••••"
                      className="h-8 text-xs bg-white"
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="space-y-1 md:col-span-1">
                    <Label className="text-[11px] font-medium text-[#1A2333]">
                      Endpoint Base da API Gov.br
                    </Label>
                    <Input
                      value={govbrApiUrl}
                      onChange={(e) => setGovbrApiUrl(e.target.value)}
                      placeholder="https://nfse.receita.fazenda.gov.br/portalnfse"
                      className="h-8 text-xs bg-white font-mono"
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="space-y-1 md:col-span-1">
                    <Label className="text-[11px] font-medium text-[#1A2333]">
                      Código IBGE do Município Padrão
                    </Label>
                    <Input
                      value={municipioIbge}
                      onChange={(e) => setMunicipioIbge(e.target.value)}
                      placeholder="Ex: 3550308 (São Paulo)"
                      className="h-8 text-xs bg-white font-mono"
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Credenciais Globais Betha */}
            {provedorFiscal === 'betha' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1A2333] flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#0FA3A3]" />
                    Credenciais Globais Betha Sistemas (ABRASF 2.x)
                  </span>
                  <span className="text-[10px] text-[#64748B]">
                    Suporta emissão direta nos municípios conveniados à Betha
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-[#1A2333]">
                      Usuário Betha Padrão
                    </Label>
                    <Input
                      value={bethaUsuario}
                      onChange={(e) => setBethaUsuario(e.target.value)}
                      placeholder="Ex: betha_usuario_escritorio"
                      className="h-8 text-xs bg-white"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-[#1A2333]">
                      Token de Acesso / Senha
                    </Label>
                    <Input
                      type="password"
                      value={bethaSenhaToken}
                      onChange={(e) => setBethaSenhaToken(e.target.value)}
                      placeholder="••••••••••••••••••••"
                      className="h-8 text-xs bg-white"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-[#1A2333]">
                      Endpoint Webservice Betha
                    </Label>
                    <Input
                      value={bethaApiUrl}
                      onChange={(e) => setBethaApiUrl(e.target.value)}
                      placeholder="https://e-gov.betha.com.br/e-nota-contribuinte-ws/nfseWS"
                      className="h-8 text-xs bg-white font-mono"
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Credenciais Globais Ginfes */}
            {provedorFiscal === 'ginfes' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1A2333] flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#0FA3A3]" />
                    Credenciais Globais Ginfes (ABRASF SOAP)
                  </span>
                  <span className="text-[10px] text-[#64748B]">
                    Suporta prefeituras operadas por Ginfes (Campinas, Santo André, etc.)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-[#1A2333]">
                      Usuário / Identificador
                    </Label>
                    <Input
                      value={ginfesUsuario}
                      onChange={(e) => setGinfesUsuario(e.target.value)}
                      placeholder="Ex: ginfes_usuario"
                      className="h-8 text-xs bg-white"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-[#1A2333]">
                      Senha Webservice
                    </Label>
                    <Input
                      type="password"
                      value={ginfesSenha}
                      onChange={(e) => setGinfesSenha(e.target.value)}
                      placeholder="••••••••••••••••••••"
                      className="h-8 text-xs bg-white"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-[#1A2333]">
                      Endpoint Service Ginfes
                    </Label>
                    <Input
                      value={ginfesApiUrl}
                      onChange={(e) => setGinfesApiUrl(e.target.value)}
                      placeholder="https://homologacao.ginfes.com.br/ServiceGinfesImpl"
                      className="h-8 text-xs bg-white font-mono"
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Testar Conexão com o Provedor Padrão */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTestarProvedorFiscal(provedorFiscal)}
              disabled={testandoProvedor || !canEdit}
              className="text-xs gap-1.5"
            >
              {testandoProvedor ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Testando Provedor Padrão...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Testar Conexão Padrão ({provedorFiscal.toUpperCase()})
                </>
              )}
            </Button>

            {resultadoTesteProvedor && (
              <div
                className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border ${
                  resultadoTesteProvedor.sucesso
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {resultadoTesteProvedor.sucesso ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                )}
                <span>{resultadoTesteProvedor.mensagem}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Webhook & Credenciais Evolution API (FRENTE 2) */}
      <Card className="rounded-2xl border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-[#0FA3A3]" />
              2. Conector WhatsApp Real (Evolution API / Baileys)
            </div>
            <Badge
              variant="outline"
              className={
                evolutionUrl && evolutionKey && evolutionInstance
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px]'
                  : 'border-slate-300 bg-slate-50 text-slate-700 text-[10px]'
              }
            >
              {evolutionUrl && evolutionKey && evolutionInstance
                ? 'Servidor Configurado'
                : 'Fila Interna / Simulado'}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs text-[#64748B]">
            Conecte sua instância da Evolution API para que o bot receba mensagens reais no WhatsApp
            e responda automaticamente após a aprovação no painel de supervisão.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-[#1A2333]">
              URL do Webhook de Entrada (Cole na Evolution API)
            </Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={webhookUrlCompleta}
                className="text-xs font-mono bg-slate-50 border-slate-200 text-[#475569]"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopiarWebhook}
                className="text-xs gap-1.5 shrink-0"
              >
                {copiado ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiado ? 'Copiado' : 'Copiar URL'}
              </Button>
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              Eventos sugeridos no painel da Evolution: <code>MESSAGES_UPSERT</code> ou{' '}
              <code>SEND_MESSAGE</code>.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-medium text-[#1A2333]">
                URL Base do Servidor Evolution
              </Label>
              <Input
                value={evolutionUrl}
                onChange={(e) => setEvolutionUrl(e.target.value)}
                placeholder="https://sua-evolution.com"
                className="text-xs h-9"
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-medium text-[#1A2333]">API Key / Token Global</Label>
              <Input
                type="password"
                value={evolutionKey}
                onChange={(e) => setEvolutionKey(e.target.value)}
                placeholder="Ex: evo_live_xyz..."
                className="text-xs h-9"
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-medium text-[#1A2333]">Nome da Instância</Label>
              <Input
                value={evolutionInstance}
                onChange={(e) => setEvolutionInstance(e.target.value)}
                placeholder="Ex: rumo-fiscal-01"
                className="text-xs h-9"
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Botão Testar Conexão Evolution */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestarEvolution}
              disabled={testandoEvo || !canEdit}
              className="text-xs gap-1.5"
            >
              {testandoEvo ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Testando Conexão WhatsApp...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Testar Conexão com Evolution API
                </>
              )}
            </Button>

            {resultadoTesteEvo && (
              <div
                className={`flex items-start gap-2 text-xs font-medium px-3 py-2 rounded-lg border max-w-xl ${
                  resultadoTesteEvo.sucesso
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : resultadoTesteEvo.status === 'falha_autenticacao'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : resultadoTesteEvo.status === 'instancia_nao_encontrada'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                {resultadoTesteEvo.sucesso ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : resultadoTesteEvo.status === 'falha_autenticacao' ? (
                  <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-bold">
                    {resultadoTesteEvo.status === 'conectada' && 'Instância Conectada'}
                    {resultadoTesteEvo.status === 'instancia_nao_encontrada' &&
                      'Instância não encontrada'}
                    {resultadoTesteEvo.status === 'falha_autenticacao' && 'Falha de Autenticação'}
                    {resultadoTesteEvo.status === 'url_inalcancavel' && 'URL Inalcançável'}
                    {resultadoTesteEvo.status === 'incompleta' && 'Campos Incompletos'}
                  </div>
                  <p className="text-[11px] font-normal leading-relaxed">
                    {resultadoTesteEvo.mensagem}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Envio de Teste Real para Número Pessoal */}
          <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4 space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-[#0FA3A3]" />
                <span className="text-xs font-bold text-[#1A2333]">
                  Envio Real de Teste para o seu WhatsApp
                </span>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] border-teal-200 text-teal-800 bg-white"
              >
                Auditoria em whatsapp_envios
              </Badge>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Digite seu número pessoal para disparar uma mensagem de teste real pela instância
              configurada. Caso as credenciais não estejam ativas, a mensagem será gravada com o
              status <code>aguardando_credenciais</code> (Modo Supervisão honesto).
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={numeroTesteWa}
                onChange={(e) => setNumeroTesteWa(e.target.value)}
                placeholder="DDD + Número (ex: 41 99999-8888)"
                className="text-xs h-9 bg-white max-w-sm"
                disabled={disparandoTesteWa || !canEdit}
              />
              <Button
                onClick={handleDispararMensagemTeste}
                disabled={disparandoTesteWa || !numeroTesteWa.trim() || !canEdit}
                className="bg-[#0FA3A3] hover:bg-[#0d8c8c] text-white text-xs gap-1.5 h-9 shrink-0"
              >
                {disparandoTesteWa ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Enviando Teste...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Disparar Teste Real
                  </>
                )}
              </Button>
            </div>

            {resultadoDisparoTeste && (
              <div
                className={`flex items-start gap-2 text-xs font-medium px-3 py-2 rounded-lg border ${
                  resultadoDisparoTeste.status === 'enviado'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : resultadoDisparoTeste.status === 'aguardando_credenciais'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {resultadoDisparoTeste.status === 'enviado' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : resultadoDisparoTeste.status === 'aguardando_credenciais' ? (
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">
                    Status:{' '}
                    {resultadoDisparoTeste.status === 'enviado'
                      ? 'Transmitido com Sucesso (Modo Real)'
                      : resultadoDisparoTeste.status === 'aguardando_credenciais'
                        ? 'Aguardando Credenciais Externas (Modo Supervisão)'
                        : 'Falha no Envio'}
                  </div>
                  <p className="text-[11px] font-normal leading-relaxed mt-0.5">
                    {resultadoDisparoTeste.mensagem}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 2.1: Parâmetros Padrão de PIX & Cobrança do Escritório */}
      <Card className="rounded-2xl border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-[#0FA3A3]" />
              Dados Padrão para Cobrança PIX / Honorários
            </div>
            <Badge
              variant="outline"
              className="text-[10px] border-teal-200 bg-teal-50 text-teal-800"
            >
              EMV BR Code Padrão BACEN
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs text-[#64748B]">
            Configure a chave PIX e o nome do beneficiário do escritório que serão sugeridos
            automaticamente ao gerar faturas e cobranças para envio por WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#1A2333]">
                Chave PIX do Escritório (Padrão)
              </Label>
              <Input
                value={chavePixPadrao}
                onChange={(e) => setChavePixPadrao(e.target.value)}
                placeholder="Ex: CNPJ, e-mail, telefone ou chave aleatória"
                className="text-xs h-9"
                disabled={!canEdit}
              />
              <p className="text-[11px] text-[#94A3B8]">
                Utilizada para gerar o payload PIX copia-e-cola nas cobranças enviadas por WhatsApp.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#1A2333]">
                Nome do Beneficiário / Razão Social
              </Label>
              <Input
                value={beneficiarioPadrao}
                onChange={(e) => setBeneficiarioPadrao(e.target.value)}
                placeholder="Ex: RUMO CONTABILIDADE LTDA"
                className="text-xs h-9"
                disabled={!canEdit}
              />
              <p className="text-[11px] text-[#94A3B8]">
                Aparece no resumo da mensagem e no padrão EMV BR Code (Tag 59).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Regras Operacionais e Empresa Padrão */}
      <Card className="rounded-2xl border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#0FA3A3]" />
            3. Regras de Supervisão & Empresa Prestadora Padrão
          </CardTitle>
          <CardDescription className="text-xs text-[#64748B]">
            Defina o comportamento do bot para novas mensagens recebidas e regras de emissão.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#1A2333]">
                Empresa Prestadora Padrão
              </Label>
              <Select value={empresaPadrao} onValueChange={setEmpresaPadrao} disabled={!canEdit}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a empresa padrão" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-[#94A3B8]">
                Usada para associar solicitações que não citam CNPJ da empresa emitente.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#1A2333]">
                Telefone de Suporte Humano
              </Label>
              <Input
                value={telefoneSuporte}
                onChange={(e) => setTelefoneSuporte(e.target.value)}
                placeholder="(11) 3214-5500"
                className="text-xs h-9"
                disabled={!canEdit}
              />
              <p className="text-[11px] text-[#94A3B8]">
                Exibido quando o bot precisa transferir para atendimento de um contador.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#1A2333]">
                Prazo Municipal Cancelamento (Dias)
              </Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={prazoDiasCancelamento}
                onChange={(e) => setPrazoDiasCancelamento(Number(e.target.value) || 30)}
                placeholder="Ex: 30"
                className="text-xs h-9 font-mono"
                disabled={!canEdit}
              />
              <p className="text-[11px] text-[#94A3B8]">
                Limite de dias para aviso de prazo extemporâneo no modal de cancelamento.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 bg-slate-50/50">
              <div className="space-y-0.5 pr-4">
                <span className="text-xs font-bold text-[#1A2333]">Canal WhatsApp Ativo</span>
                <p className="text-[11px] text-[#64748B]">
                  Aceitar e processar solicitações via webhook
                </p>
              </div>
              <Switch checked={ativo} onCheckedChange={setAtivo} disabled={!canEdit} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 bg-slate-50/50">
              <div className="space-y-0.5 pr-4">
                <span className="text-xs font-bold text-[#1A2333]">Modo de Emissão Fiscal</span>
                <p className="text-[11px] text-[#64748B]">
                  {modoOperacao === 'simulacao'
                    ? 'Simulação controlada (sem cobrança na prefeitura)'
                    : 'Produção oficial (Gov.br / Betha / Ginfes)'}
                </p>
              </div>
              <Select
                value={modoOperacao}
                onValueChange={(val: 'simulacao' | 'producao') => setModoOperacao(val)}
                disabled={!canEdit}
              >
                <SelectTrigger className="w-32 h-8 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simulacao" className="text-xs">
                    Simulação
                  </SelectItem>
                  <SelectItem value="producao" className="text-xs">
                    Produção
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Modelos de Mensagens do Bot (Etapas 1 e 8) */}
      <Card className="rounded-2xl border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
            <Key className="h-4 w-4 text-[#0FA3A3]" />
            4. Mensagens Automáticas do Bot (Etapa 8 - Respostas de Volta)
          </CardTitle>
          <CardDescription className="text-xs text-[#64748B]">
            Personalize as respostas enviadas ao cliente no WhatsApp em cada etapa do framework.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-[#1A2333]">
              Mensagem de Confirmação de Recebimento (Em Análise)
            </Label>
            <Textarea
              rows={2}
              value={msgRecebimento}
              onChange={(e) => setMsgRecebimento(e.target.value)}
              className="text-xs"
              disabled={!canEdit}
            />
            <p className="text-[10px] text-[#94A3B8]">
              Disparada imediatamente após o motor cognitivo extrair os dados. Sempre informa que a
              nota está sob revisão contábil.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-[#1A2333]">
              Mensagem de Devolução / Rejeição (com variável <code>{'{{motivo}}'}</code>)
            </Label>
            <Textarea
              rows={2}
              value={msgRejeicao}
              onChange={(e) => setMsgRejeicao(e.target.value)}
              className="text-xs"
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-[#1A2333]">
              Mensagem de Nota Emitida com Sucesso (variáveis: <code>{'{{numero_nota}}'}</code>,{' '}
              <code>{'{{codigo_verificacao}}'}</code>, <code>{'{{valor}}'}</code>)
            </Label>
            <Textarea
              rows={3}
              value={msgNotaEmitida}
              onChange={(e) => setMsgNotaEmitida(e.target.value)}
              className="text-xs"
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* Botão Salvar Geral */}
      {canEdit && (
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSalvar}
            disabled={salvando}
            className="bg-[#0FA3A3] hover:bg-[#0d8c8c] text-white text-xs gap-1.5 px-6 shadow-sm"
          >
            {salvando ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Salvando Configurações...
              </>
            ) : (
              'Salvar Configurações do WhatsApp & Provedores Fiscais'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

function empresaMapNome(empresas: Empresa[], id: string): string {
  const f = empresas.find((e) => e.id === id)
  return f ? f.razao_social : 'Selecionada'
}

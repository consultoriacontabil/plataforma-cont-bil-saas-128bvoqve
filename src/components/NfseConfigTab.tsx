import React, { useState } from 'react'
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
} from 'lucide-react'
import type { NfseConfigRecord, Empresa, ProvedorFiscalTipo, ProvedorAmbiente } from '@/types'
import { nfseWhatsappService } from '@/services/nfseWhatsapp'
import { FiscalAdapterFactory } from '@/services/fiscalAdapters'
import { useToast } from '@/hooks/use-toast'

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

  // Provedores Fiscais (Frente 1)
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

  // Mensagens
  const [msgSaudacao, setMsgSaudacao] = useState<string>(config?.msg_saudacao || '')
  const [msgRecebimento, setMsgRecebimento] = useState<string>(config?.msg_recebimento || '')
  const [msgAprovacao, setMsgAprovacao] = useState<string>(config?.msg_aprovacao || '')
  const [msgRejeicao, setMsgRejeicao] = useState<string>(config?.msg_rejeicao || '')
  const [msgNotaEmitida, setMsgNotaEmitida] = useState<string>(config?.msg_nota_emitida || '')

  const [salvando, setSalvando] = useState(false)
  const [testandoEvo, setTestandoEvo] = useState(false)
  const [resultadoTesteEvo, setResultadoTesteEvo] = useState<{
    sucesso: boolean
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
          modo_operacao: modoOperacao,
          auto_aprovar_alta_confianca: autoAprovar,
          provedor_fiscal: provedorFiscal,
          provedor_ambiente: provedorAmbiente,
          govbr_client_id: govbrClientId.trim(),
          govbr_client_secret: govbrClientSecret.trim(),
          govbr_api_url: govbrApiUrl.trim(),
          provedor_municipio_ibge: municipioIbge.trim(),
          msg_saudacao: msgSaudacao.trim(),
          msg_recebimento: msgRecebimento.trim(),
          msg_aprovacao: msgAprovacao.trim(),
          msg_rejeicao: msgRejeicao.trim(),
          msg_nota_emitida: msgNotaEmitida.trim(),
          telefone_suporte: telefoneSuporte.trim(),
          ativo,
        },
        currentUserId,
      )

      toast({
        title: 'Configurações salvas!',
        description: 'Os parâmetros do canal WhatsApp e provedor fiscal foram atualizados.',
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
          title: 'Conexão estabelecida com sucesso',
          description: res.mensagem,
        })
      } else {
        toast({
          title: 'Falha no teste com a Evolution API',
          description: res.mensagem,
          variant: 'destructive',
        })
      }
    } finally {
      setTestandoEvo(false)
    }
  }

  const handleTestarProvedorFiscal = async () => {
    setTestandoProvedor(true)
    setResultadoTesteProvedor(null)
    try {
      const res = await nfseWhatsappService.testarConexaoProvedor({
        tenantId,
        provedor: provedorFiscal,
        apiUrl: govbrApiUrl,
        clientId: govbrClientId,
        clientSecret: govbrClientSecret,
        municipioIbge,
        empresaId: empresaPadrao,
      })

      setResultadoTesteProvedor(res)
      if (res.sucesso) {
        toast({
          title: 'Conexão com Provedor Fiscal confirmada!',
          description: res.mensagem,
        })
      } else {
        toast({
          title: 'Teste de conexão com Provedor Fiscal',
          description: res.mensagem,
          variant: res.mensagem.includes('incompletas') ? 'default' : 'destructive',
        })
      }
    } finally {
      setTestandoProvedor(false)
    }
  }

  const temCredenciaisGovbr = !!(govbrClientId.trim() && govbrClientSecret.trim())
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
                Arquitetura do Canal WhatsApp & Motor Fiscal de NFS-e
              </h3>
              <Badge
                className={
                  temCredenciaisGovbr && modoOperacao === 'producao'
                    ? 'bg-emerald-600 text-white text-[10px]'
                    : 'bg-amber-600 text-white text-[10px]'
                }
              >
                {temCredenciaisGovbr && modoOperacao === 'producao'
                  ? 'PRODUÇÃO — GOV.BR'
                  : 'MODO SIMULAÇÃO CONTROLADA'}
              </Badge>
            </div>
            <p className="text-xs text-[#475569] leading-relaxed">
              O módulo conecta a <strong>Evolution API</strong> (WhatsApp real) ao{' '}
              <strong>Motor Cognitivo IA</strong>, ao <strong>Painel de Supervisão</strong> e ao{' '}
              <strong>Adapter de Provedores Fiscais (Gov.br / Betha / Ginfes)</strong>.
            </p>
          </div>
        </div>

        {/* Banner honesto sobre credenciais de emissão e fallback */}
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900">
          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong>Honestidade da Integração Fiscal & Simulação Controlada:</strong>
            <p className="text-[11px] text-blue-800 leading-normal">
              Quando o tenant possui credenciais e certificado e-CNPJ A1 cadastrados, a emissão é
              transmitida diretamente ao <strong>Emissor Nacional Gov.br</strong>. Se ainda não
              houver credenciais ativas, o sistema opera automaticamente em{' '}
              <strong>Modo Simulação Controlada</strong> com geração de XML ABRASF válido, número
              sequencial e DANFSE para impressão, garantindo que o escritório nunca pare.
            </p>
          </div>
        </div>
      </div>

      {/* Card 1: Conector Provedor Fiscal (FRENTE 1) */}
      <Card className="rounded-2xl border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-[#0FA3A3]" />
              1. Provedor Fiscal de NFS-e (Adapter Pattern — Gov.br / Betha / Ginfes)
            </div>
            <Badge
              variant="outline"
              className={
                temCredenciaisGovbr
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px]'
                  : 'border-amber-300 bg-amber-50 text-amber-800 text-[10px]'
              }
            >
              {temCredenciaisGovbr ? 'Credenciais Configuradas' : 'Requer Credenciais'}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs text-[#64748B]">
            Selecione o provedor tributário. O Emissor Nacional (Gov.br) é o padrão federal ativo;
            Betha e Ginfes estão disponíveis como pontos de extensão arquiteturais.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#1A2333]">
                Provedor Fiscal Selecionado
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
                      {ad.nome} {ad.statusDisponibilidade === 'em_breve' ? '(Em breve)' : '— Ativo'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-[#64748B]">
                {provedorFiscal === 'governacional'
                  ? 'Padrão Nacional da Receita Federal (Emissor Nacional Gov.br).'
                  : 'Ponto de extensão arquitetural. Requer credenciais próprias do município.'}
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

          {/* Credenciais Gov.br */}
          {provedorFiscal === 'governacional' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1A2333] flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#0FA3A3]" />
                  Credenciais de Acesso API Gov.br (Emissor Nacional)
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
                    Código IBGE do Município Emissor
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

              {/* Informações sobre o Certificado Digital A1 */}
              <div className="rounded-lg bg-white border border-slate-200 p-2.5 flex items-start gap-2 text-xs">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-[#475569] leading-tight">
                  <strong>Certificado e-CNPJ A1:</strong> A emissão utiliza o certificado digital A1
                  armazenado na empresa prestadora (gerenciado na tela de Empresas e Certificados
                  Digitais). A autenticação mTLS/assinatura XML é executada na transmissão da NFS-e.
                </div>
              </div>
            </div>
          )}

          {/* Ponto de Extensão Betha / Ginfes */}
          {(provedorFiscal === 'betha' || provedorFiscal === 'ginfes') && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                Ponto de Extensão Arquitetural: {provedorFiscal.toUpperCase()}
              </div>
              <p className="text-[11px] text-amber-800 leading-normal">
                A interface do Adapter para {provedorFiscal.toUpperCase()} já está estruturada e
                conectada ao fluxo. Para ativar a emissão direta na sua prefeitura com este
                provedor, certifique-se de que os webservices SOAP municipais estão liberados para o
                CNPJ do prestador.
              </p>
            </div>
          )}

          {/* Testar Conexão com o Provedor */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestarProvedorFiscal}
              disabled={testandoProvedor || !canEdit}
              className="text-xs gap-1.5"
            >
              {testandoProvedor ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Testando Provedor...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Testar Conexão com Provedor Fiscal ({provedorFiscal})
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
                className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border ${
                  resultadoTesteEvo.sucesso
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {resultadoTesteEvo.sucesso ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                )}
                <span>{resultadoTesteEvo.mensagem}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Regras Operacionais e Empresa Padrão */}
      <Card className="rounded-2xl border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#0FA3A3]" />
            3. Regras de Supervisão & Empresa Prestadora
          </CardTitle>
          <CardDescription className="text-xs text-[#64748B]">
            Defina o comportamento do bot para novas mensagens recebidas e regras de emissão.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    : 'Produção real (Gov.br Emissor Nacional)'}
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
              'Salvar Configurações do WhatsApp & Provedor'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

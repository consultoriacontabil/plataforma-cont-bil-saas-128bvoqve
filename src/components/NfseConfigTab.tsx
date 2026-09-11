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
  HelpCircle,
} from 'lucide-react'
import type { NfseConfigRecord, Empresa } from '@/types'
import { nfseWhatsappService } from '@/services/nfseWhatsapp'
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

  // Mensagens
  const [msgSaudacao, setMsgSaudacao] = useState<string>(config?.msg_saudacao || '')
  const [msgRecebimento, setMsgRecebimento] = useState<string>(config?.msg_recebimento || '')
  const [msgAprovacao, setMsgAprovacao] = useState<string>(config?.msg_aprovacao || '')
  const [msgRejeicao, setMsgRejeicao] = useState<string>(config?.msg_rejeicao || '')
  const [msgNotaEmitida, setMsgNotaEmitida] = useState<string>(config?.msg_nota_emitida || '')

  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)
  const [resultadoTeste, setResultadoTeste] = useState<{
    sucesso: boolean
    mensagem: string
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
        description: 'Os parâmetros do canal WhatsApp e regras fiscais foram atualizados.',
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

  const handleTestarConexao = async () => {
    setTestando(true)
    setResultadoTeste(null)
    try {
      const res = await nfseWhatsappService.testarConexaoEvolution(
        evolutionUrl,
        evolutionKey,
        evolutionInstance,
      )
      setResultadoTeste(res)
      if (res.sucesso) {
        toast({
          title: 'Conexão estabelecida com sucesso',
          description: res.mensagem,
        })
      } else {
        toast({
          title: 'Falha no teste de conexão',
          description: res.mensagem,
          variant: 'destructive',
        })
      }
    } finally {
      setTestando(false)
    }
  }

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
                Arquitetura do Canal WhatsApp & Bot Engine
              </h3>
              <Badge className="bg-[#0FA3A3] text-white text-[10px]">
                {modoOperacao === 'simulacao' ? 'MODO SIMULAÇÃO ATIVO' : 'MODO PRODUÇÃO'}
              </Badge>
            </div>
            <p className="text-xs text-[#475569] leading-relaxed">
              O fluxo de emissão conecta mensagens recebidas pelo seu servidor WhatsApp (Evolution
              API / Baileys) ao <strong>Motor Cognitivo IA</strong>, que estrutura os dados fiscais
              e alimenta o <strong>Painel de Supervisão</strong>.
            </p>
          </div>
        </div>

        {/* Banner honesto sobre conexão com servidor do usuário */}
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900">
          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong>Como funciona a conexão real com o WhatsApp?</strong>
            <p className="text-[11px] text-blue-800 leading-normal">
              A conexão real requer uma instância ativa da <strong>Evolution API ou Baileys</strong>{' '}
              hospedada em servidor próprio ou VPS. Caso ainda não possua servidor configurado, a
              plataforma opera perfeitamente em <strong>Modo Simulação Controlada</strong>,
              permitindo receber webhooks de teste, supervisionar, aprovar e emitir NFS-e com XML e
              DANFSE completos.
            </p>
          </div>
        </div>
      </div>

      {/* Card 1: Webhook & Credenciais Evolution API */}
      <Card className="rounded-2xl border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#0FA3A3]" />
            1. Webhook do Bot Engine (Etapa 1 do Framework)
          </CardTitle>
          <CardDescription className="text-xs text-[#64748B]">
            Configure esta URL de Webhook no painel da Evolution API para receber mensagens
            automaticamente neste tenant.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-[#1A2333]">
              URL do Webhook (Endpoint Seguro)
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
              Método: <code>POST</code> | Header sugerido:{' '}
              <code>Content-Type: application/json</code>
            </p>
          </div>

          <div className="border-t border-slate-100 pt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-medium text-[#1A2333]">
                URL Base da Evolution API
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

          {/* Botão Testar Conexão */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestarConexao}
              disabled={testando || !canEdit}
              className="text-xs gap-1.5"
            >
              {testando ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Testando Conexão...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Testar Conexão com Evolution API
                </>
              )}
            </Button>

            {resultadoTeste && (
              <div
                className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border ${
                  resultadoTeste.sucesso
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {resultadoTeste.sucesso ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                )}
                <span>{resultadoTeste.mensagem}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Regras Operacionais e Empresa Padrão */}
      <Card className="rounded-2xl border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#0FA3A3]" />
            2. Regras de Supervisão & Empresa Prestadora
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
                    ? 'Simulação controlada (sem envio à prefeitura)'
                    : 'Produção real (Webservice / Gov.br)'}
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

      {/* Card 3: Modelos de Mensagens do Bot (Etapas 1 e 8) */}
      <Card className="rounded-2xl border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-2">
            <Key className="h-4 w-4 text-[#0FA3A3]" />
            3. Mensagens Automáticas do Bot (Etapa 8 - Respostas de Volta)
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
              'Salvar Configurações do WhatsApp'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Lock,
  KeyRound,
  FileCheck2,
  Clock,
  History,
  Activity,
  Server,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { rfbConectorService } from '@/services/rfbConector'
import { certificadosService } from '@/services/certificados'
import { formatDateTimePtBr } from '@/lib/formatters'
import type {
  Empresa,
  CertificadoDigitalRecord,
  RfbConfigRecord,
  RfbSyncLogRecord,
  RfbDiagnosticoResult,
} from '@/types'

interface EmpresaConectorRfbTabProps {
  empresa: Empresa
  onSyncCompleted?: () => void
}

export function EmpresaConectorRfbTab({ empresa, onSyncCompleted }: EmpresaConectorRfbTabProps) {
  const { tenant, member } = useAuth()
  const { toast } = useToast()

  // Permissão: Apenas Contador ou Administrador podem alterar credenciais / sincronizar
  // Auxiliar vê apenas status / diagnóstico; Cliente não acessa
  const perfil = member?.perfil
  const podeEditar = perfil === 'administrador' || perfil === 'contador'

  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)

  // Config do Conector
  const [config, setConfig] = useState<RfbConfigRecord | null>(null)
  const [ativo, setAtivo] = useState(true)
  const [ambiente, setAmbiente] = useState<'producao' | 'homologacao'>('homologacao')
  const [cnpjContribuinte, setCnpjContribuinte] = useState(empresa.cnpj || '')
  const [certificadoId, setCertificadoId] = useState<string>('')
  const [senhaCertificado, setSenhaCertificado] = useState('')
  const [contratoDteId, setContratoDteId] = useState('')
  const [tokenAmbienteRfb, setTokenAmbienteRfb] = useState('')
  const [sincronizacaoAutomatica, setSincronizacaoAutomatica] = useState(true)
  const [sincronizarCertidoes, setSincronizarCertidoes] = useState(true)
  const [sincronizarEcac, setSincronizarEcac] = useState(true)

  // Certificados da empresa
  const [certificados, setCertificados] = useState<CertificadoDigitalRecord[]>([])
  const [certificadoSelecionado, setCertificadoSelecionado] =
    useState<CertificadoDigitalRecord | null>(null)

  // Logs e Diagnóstico
  const [logs, setLogs] = useState<RfbSyncLogRecord[]>([])
  const [ultimoDiagnostico, setUltimoDiagnostico] = useState<RfbDiagnosticoResult | null>(null)
  const [logInspecionado, setLogInspecionado] = useState<RfbSyncLogRecord | null>(null)
  const [mostrarAjudaDte, setMostrarAjudaDte] = useState(false)

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true)

      // 1. Carregar certificados digitais da empresa
      const certSingle = await certificadosService.getByEmpresa(empresa.id)
      const certs = certSingle ? [certSingle] : []
      setCertificados(certs)

      // 2. Carregar configuração RFB
      const cfg = await rfbConectorService.getConfig(empresa.id)
      const certAtivo = certs.find((c) => c.status === 'ativo') || certs[0]
      if (cfg) {
        setConfig(cfg)
        setAtivo(cfg.ativo)
        setAmbiente(cfg.ambiente)
        setCnpjContribuinte(cfg.cnpj_contribuinte || empresa.cnpj || '')
        const effectiveCertId = cfg.certificado_a1 || certAtivo?.id || ''
        setCertificadoId(effectiveCertId)
        setSenhaCertificado(cfg.senha_certificado || certAtivo?.senha || '')
        setContratoDteId(cfg.contrato_dte_id || '')
        setTokenAmbienteRfb(cfg.token_ambiente_rfb || '')
        setSincronizacaoAutomatica(cfg.sincronizacao_automatica)
        setSincronizarCertidoes(cfg.sincronizar_certidoes)
        setSincronizarEcac(cfg.sincronizar_ecac)
        if (cfg.ultimo_diagnostico_json) {
          setUltimoDiagnostico(cfg.ultimo_diagnostico_json)
        }
      } else {
        // Valores default
        setCnpjContribuinte(empresa.cnpj || '')
        if (certAtivo) {
          setCertificadoId(certAtivo.id)
          setSenhaCertificado(certAtivo.senha || '')
        }
      }

      // 3. Carregar histórico de logs
      const syncLogs = await rfbConectorService.listLogs(empresa.id, 20)
      setLogs(syncLogs)
    } catch (err) {
      console.error('[RFB] Erro ao carregar dados:', err)
      toast({
        title: 'Erro ao carregar dados do conector',
        description: 'Não foi possível carregar as configurações do Conector RFB.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [empresa.id, empresa.cnpj, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  useEffect(() => {
    if (certificadoId) {
      const c = certificados.find((item) => item.id === certificadoId) || null
      setCertificadoSelecionado(c)
    } else if (certificados.length > 0) {
      setCertificadoSelecionado(certificados[0])
    } else {
      setCertificadoSelecionado(null)
    }
  }, [certificadoId, certificados])

  // Salvar Configurações
  const handleSalvar = async () => {
    if (!tenant) return
    try {
      setSalvando(true)
      const salvo = await rfbConectorService.salvarConfig({
        tenant_id: tenant.id,
        empresa: empresa.id,
        ativo,
        ambiente,
        cnpj_contribuinte: cnpjContribuinte,
        certificado_a1: certificadoId || undefined,
        senha_certificado: senhaCertificado,
        contrato_dte_id: contratoDteId,
        token_ambiente_rfb: tokenAmbienteRfb,
        sincronizacao_automatica: sincronizacaoAutomatica,
        sincronizar_certidoes: sincronizarCertidoes,
        sincronizar_ecac: sincronizarEcac,
      })
      setConfig(salvo)
      toast({
        title: 'Configurações salvas',
        description: 'Parâmetros do Conector RFB atualizados com sucesso.',
      })
    } catch (err) {
      console.error('[RFB] Erro ao salvar:', err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível atualizar as configurações do Conector.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Testar Credenciais RFB
  const handleTestarCredenciais = async () => {
    if (!tenant) return
    try {
      setTestando(true)
      const diag = await rfbConectorService.testarCredenciais({
        tenant_id: tenant.id,
        empresa_id: empresa.id,
        cnpj_contribuinte: cnpjContribuinte,
        certificado_a1: certificadoId,
        senha_certificado: senhaCertificado,
        contrato_dte_id: contratoDteId,
        token_ambiente_rfb: tokenAmbienteRfb,
        ambiente,
      })
      setUltimoDiagnostico(diag)

      // Atualizar logs
      const syncLogs = await rfbConectorService.listLogs(empresa.id, 20)
      setLogs(syncLogs)

      if (diag.sucesso) {
        toast({
          title: 'Credenciais validadas com sucesso!',
          description: diag.mensagem,
        })
      } else {
        toast({
          title: 'Diagnóstico de Credenciais RFB',
          description: diag.mensagem,
          variant: 'destructive',
        })
      }
    } catch (err: unknown) {
      console.error('[RFB] Erro no teste:', err)
      toast({
        title: 'Falha ao testar credenciais',
        description:
          (err as { message?: string })?.message ||
          'Não foi possível concluir o teste de diagnóstico.',
        variant: 'destructive',
      })
    } finally {
      setTestando(false)
    }
  }

  // Sincronizar Agora
  const handleSincronizarAgora = async () => {
    if (!tenant) return
    try {
      setSincronizando(true)
      const result = await rfbConectorService.sincronizarAgora({
        tenant_id: tenant.id,
        empresa_id: empresa.id,
      })

      // Atualizar logs e recarregar dados
      const syncLogs = await rfbConectorService.listLogs(empresa.id, 20)
      setLogs(syncLogs)
      if (onSyncCompleted) onSyncCompleted()

      if (result.sucesso) {
        toast({
          title: 'Sincronização concluída!',
          description: result.mensagem,
        })
      } else {
        toast({
          title: 'Modo Supervisão (Sincronismo Direto Não Executado)',
          description: result.mensagem,
          variant: 'destructive',
        })
      }
    } catch (err: unknown) {
      console.error('[RFB] Erro no sincronizar:', err)
      toast({
        title: 'Falha na sincronização',
        description:
          (err as { message?: string })?.message ||
          'Ocorreu um erro ao comunicar com a Receita Federal.',
        variant: 'destructive',
      })
    } finally {
      setSincronizando(false)
    }
  }

  // Determinar status para o badge
  const statusConexao = config?.status_conexao || (ativo ? 'modo_supervisao' : 'desconectado')
  const temCredenciaisValidas =
    ultimoDiagnostico?.sucesso ||
    (statusConexao === 'conectado' && Boolean(contratoDteId || tokenAmbienteRfb))

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
        <RefreshCw className="h-5 w-5 animate-spin" />
        Carregando Conector RFB...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DO CONECTOR E STATUS */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Server className="h-5 w-5 text-primary" />
                  Conector RFB / e-CAC DTE
                </CardTitle>

                {/* BADGE DE MODO DE OPERAÇÃO HONESTO */}
                {temCredenciaisValidas ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Conector Direto Ativo
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Modo Supervisão
                  </Badge>
                )}

                <Badge variant="secondary" className="uppercase text-[10px]">
                  {ambiente === 'producao' ? 'Produção' : 'Homologação'}
                </Badge>
              </div>
              <CardDescription>
                Sincronização direta e contínua da Caixa Postal DTE do e-CAC e Certidões Federais
                com anti-duplicidade e anti-flood.
              </CardDescription>
            </div>

            {/* AÇÕES PRINCIPAIS */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestarCredenciais}
                disabled={testando || !podeEditar}
                className="gap-2"
              >
                <Activity className={`h-4 w-4 ${testando ? 'animate-spin' : ''}`} />
                {testando ? 'Diagnosticando...' : 'Testar Credenciais RFB'}
              </Button>

              <Button
                size="sm"
                onClick={handleSincronizarAgora}
                disabled={sincronizando || !podeEditar}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <RefreshCw className={`h-4 w-4 ${sincronizando ? 'animate-spin' : ''}`} />
                {sincronizando ? 'Sincronizando...' : 'Sincronizar Agora'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {/* BANNER INFORMATIVO SE ESTIVER EM MODO SUPERVISÃO */}
          {!temCredenciaisValidas && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 mb-4 text-sm text-foreground">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    Conector operando em Modo Supervisão Assistido
                  </p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    O conector não executa requisições automatizadas falsas. Para ativar a
                    sincronização direta em lote às 08h e sob demanda, é obrigatório vincular o
                    <strong> Certificado e-CNPJ A1</strong> com senha válida e informar o{' '}
                    <strong>ID do Contrato/Autorização DTE</strong> cadastrado no e-CAC da Receita
                    Federal. Enquanto não fornecidos, os alertas continuam operando pelo controle
                    manual existente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ÚLTIMO DIAGNÓSTICO DETALHADO (SE HOUVER) */}
          {ultimoDiagnostico && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Diagnóstico Real das Credenciais
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Verificado em: {formatDateTimePtBr(ultimoDiagnostico.data_verificacao)}
                </span>
              </div>

              <p className="text-xs text-foreground font-medium">{ultimoDiagnostico.mensagem}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                {ultimoDiagnostico.itens.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-xs p-2.5 rounded bg-muted/40 border border-border/50"
                  >
                    {item.status === 'ok' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-semibold block">{item.item}</span>
                      <span className="text-muted-foreground text-[11px] leading-tight">
                        {item.detalhe}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FORMULÁRIO DE CONFIGURAÇÃO DE CREDENCIAIS */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                Credenciais e Parâmetros de Integração RFB
              </CardTitle>
              <CardDescription>
                Configuração segura por empresa. Somente Contador e Administrador têm permissão para
                visualizar e alterar chaves.
              </CardDescription>
            </div>
            {!podeEditar && (
              <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                <Lock className="h-3 w-3" />
                Somente Leitura (Auxiliar)
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Ativo / Inativo */}
            <div className="space-y-1.5 flex flex-col justify-center border p-3 rounded-md bg-muted/20">
              <div className="flex items-center justify-between">
                <Label htmlFor="rfb-ativo" className="text-xs font-semibold cursor-pointer">
                  Conector Habilitado
                </Label>
                <Switch
                  id="rfb-ativo"
                  checked={ativo}
                  onCheckedChange={setAtivo}
                  disabled={!podeEditar}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Habilita o monitoramento contínuo para esta empresa
              </p>
            </div>

            {/* Ambiente */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ambiente do Webservice</Label>
              <Select
                value={ambiente}
                onValueChange={(val: 'producao' | 'homologacao') => setAmbiente(val)}
                disabled={!podeEditar}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Selecione o ambiente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologação / Testes RFB</SelectItem>
                  <SelectItem value="producao">Produção Oficial RFB</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Selecione homologação para testes preliminares
              </p>
            </div>

            {/* CNPJ Contribuinte */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">CNPJ do Contribuinte</Label>
              <Input
                value={cnpjContribuinte}
                onChange={(e) => setCnpjContribuinte(e.target.value)}
                disabled={!podeEditar}
                placeholder="00.000.000/0000-00"
                className="text-xs h-9 font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                CNPJ registrado perante a Receita Federal
              </p>
            </div>
          </div>

          {/* LINHA DO CERTIFICADO A1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Seletor de Certificado Vinculado */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <FileCheck2 className="h-3.5 w-3.5 text-primary" />
                  Certificado e-CNPJ A1 Vinculado
                </Label>
                {certificadoSelecionado ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-emerald-600 border-emerald-500/30"
                  >
                    {certificadoSelecionado.tipo.toUpperCase()} •{' '}
                    {certificadoSelecionado.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-destructive border-destructive/30"
                  >
                    Nenhum A1 detectado
                  </Badge>
                )}
              </div>

              {certificados.length > 0 ? (
                <Select
                  value={certificadoId}
                  onValueChange={(val) => setCertificadoId(val)}
                  disabled={!podeEditar}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Selecione o certificado digital da empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {certificados.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.titular} ({c.tipo.toUpperCase()} - Val: {c.validade?.slice(0, 10)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-xs border border-dashed rounded p-2.5 text-muted-foreground bg-muted/10">
                  Nenhum certificado A1 cadastrado na empresa.{' '}
                  <span className="text-primary underline cursor-pointer">
                    Vincule na aba Certificado Digital.
                  </span>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Utiliza a chave mTLS para autenticação no DTE da RFB.
              </p>
            </div>

            {/* Senha do Certificado */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-primary" />
                Senha da Chave Privada (.pfx)
              </Label>
              <Input
                type="password"
                value={senhaCertificado}
                onChange={(e) => setSenhaCertificado(e.target.value)}
                disabled={!podeEditar}
                placeholder={podeEditar ? 'Senha do certificado A1' : '••••••••'}
                className="text-xs h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                Necessária para assinar os envelopes SOAP e handshake com a RFB.
              </p>
            </div>
          </div>

          {/* CONTRATO DTE / WEBSERVICE RFB */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  ID do Contrato / Autorização DTE
                  <button
                    type="button"
                    onClick={() => setMostrarAjudaDte(!mostrarAjudaDte)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </Label>
              </div>
              <Input
                value={contratoDteId}
                onChange={(e) => setContratoDteId(e.target.value)}
                disabled={!podeEditar}
                placeholder="Ex: DTE-2026-98102 ou número do termo e-CAC"
                className="text-xs h-9 font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Número do termo de adesão ou contrato webservice do Domicílio Tributário.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Token de Ambiente / API RFB (Opcional)</Label>
              <Input
                type="password"
                value={tokenAmbienteRfb}
                onChange={(e) => setTokenAmbienteRfb(e.target.value)}
                disabled={!podeEditar}
                placeholder={podeEditar ? 'Bearer / API Token RFB (se aplicável)' : '••••••••'}
                className="text-xs h-9 font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Token adicional para gateways integradores e serviços SERPRO.
              </p>
            </div>
          </div>

          {/* AJUDA EXPANSÍVEL DTE */}
          {mostrarAjudaDte && (
            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground border border-border space-y-1">
              <p className="font-semibold text-foreground">
                Como obter a autorização do DTE no e-CAC?
              </p>
              <p>
                1. Acesse o portal e-CAC da Receita Federal com o certificado digital da empresa ou
                procuração eletrônica.
              </p>
              <p>
                2. Navegue até &quot;Caixa Postal&quot; &gt; &quot;Domicílio Tributário Eletrônico
                (DTE)&quot; &gt; &quot;Autorização de Acesso por Webservice&quot;.
              </p>
              <p>
                3. Gere o ID do Contrato ou Código de Habilitação do Webservice e informe no campo
                acima.
              </p>
            </div>
          )}

          {/* OPÇÕES DE SINCRONIZAÇÃO */}
          <div className="pt-2 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center justify-between border p-2.5 rounded bg-card">
              <div>
                <Label htmlFor="opt-auto" className="text-xs font-medium cursor-pointer">
                  Rotina Diária 08h
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Incluir no job das 08h com anti-flood
                </p>
              </div>
              <Switch
                id="opt-auto"
                checked={sincronizacaoAutomatica}
                onCheckedChange={setSincronizacaoAutomatica}
                disabled={!podeEditar}
              />
            </div>

            <div className="flex items-center justify-between border p-2.5 rounded bg-card">
              <div>
                <Label htmlFor="opt-ecac" className="text-xs font-medium cursor-pointer">
                  Caixa Postal DTE
                </Label>
                <p className="text-[10px] text-muted-foreground">Sincronizar avisos e intimações</p>
              </div>
              <Switch
                id="opt-ecac"
                checked={sincronizarEcac}
                onCheckedChange={setSincronizarEcac}
                disabled={!podeEditar}
              />
            </div>

            <div className="flex items-center justify-between border p-2.5 rounded bg-card">
              <div>
                <Label htmlFor="opt-cert" className="text-xs font-medium cursor-pointer">
                  Certidões Federais
                </Label>
                <p className="text-[10px] text-muted-foreground">Consultar CND / CPEN da PGFN</p>
              </div>
              <Switch
                id="opt-cert"
                checked={sincronizarCertidoes}
                onCheckedChange={setSincronizarCertidoes}
                disabled={!podeEditar}
              />
            </div>
          </div>

          {/* BOTÃO SALVAR */}
          {podeEditar && (
            <div className="pt-2 flex justify-end">
              <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {salvando ? 'Salvando...' : 'Salvar Configurações RFB'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* HISTÓRICO DE LOGS DE SINCRONIZAÇÃO */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Histórico de Execuções e Diagnósticos RFB
              </CardTitle>
              <CardDescription>
                Registro auditado de cada varredura, teste e sincronização com duração e resultado
                real.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const syncLogs = await rfbConectorService.listLogs(empresa.id, 20)
                setLogs(syncLogs)
              }}
              className="gap-1 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              Atualizar
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded">
              Nenhuma execução registrada até o momento. Utilize o botão &quot;Testar Credenciais
              RFB&quot; ou &quot;Sincronizar Agora&quot;.
            </div>
          ) : (
            <div className="divide-y divide-border border rounded-md overflow-hidden">
              {logs.map((log) => {
                const ehSucesso = log.sucesso
                const ehSupervisao = log.modo_operacao === 'modo_supervisao'

                return (
                  <div
                    key={log.id}
                    className="p-3 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {ehSucesso ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] gap-1 py-0">
                            <CheckCircle2 className="h-3 w-3" /> Sucesso
                          </Badge>
                        ) : ehSupervisao ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] gap-1 py-0"
                          >
                            <AlertTriangle className="h-3 w-3" /> Modo Supervisão
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] gap-1 py-0">
                            <XCircle className="h-3 w-3" /> Falha
                          </Badge>
                        )}

                        <Badge variant="secondary" className="text-[10px] uppercase">
                          {log.origem_acionamento === 'manual'
                            ? 'Manual'
                            : log.origem_acionamento === 'cron_diario'
                              ? 'Job Diário 08h'
                              : 'Teste'}
                        </Badge>

                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDateTimePtBr(log.created)}
                        </span>

                        {log.duracao_ms > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            ({log.duracao_ms} ms)
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-foreground font-medium line-clamp-2">
                        {log.mensagem}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>
                          Comunicações novas:{' '}
                          <strong className="text-foreground">{log.comunicacoes_novas}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Certidões atualizadas:{' '}
                          <strong className="text-foreground">{log.certidoes_atualizadas}</strong>
                        </span>
                        {log.expand?.executado_por?.name && (
                          <>
                            <span>•</span>
                            <span>Por: {log.expand.executado_por.name}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLogInspecionado(log)}
                      className="text-xs self-end sm:self-center shrink-0"
                    >
                      Ver Detalhes
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE INSPEÇÃO DO LOG */}
      <Dialog open={!!logInspecionado} onOpenChange={(open) => !open && setLogInspecionado(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Detalhes da Execução RFB
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registro auditado ID: {logInspecionado?.id}
            </DialogDescription>
          </DialogHeader>

          {logInspecionado && (
            <div className="space-y-3 text-xs">
              <div className="p-2.5 rounded bg-muted/40 space-y-1">
                <div className="flex justify-between">
                  <span className="font-semibold text-muted-foreground">Data/Hora:</span>
                  <span>{formatDateTimePtBr(logInspecionado.created)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-muted-foreground">Origem:</span>
                  <span className="capitalize">{logInspecionado.origem_acionamento}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-muted-foreground">Modo:</span>
                  <span>{logInspecionado.modo_operacao}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-muted-foreground">Duração:</span>
                  <span>{logInspecionado.duracao_ms} ms</span>
                </div>
              </div>

              <div>
                <span className="font-semibold block mb-1">Mensagem do Conector:</span>
                <p className="p-2.5 border rounded bg-card text-foreground">
                  {logInspecionado.mensagem}
                </p>
              </div>

              {logInspecionado.detalhes_json && (
                <div>
                  <span className="font-semibold block mb-1">Payload / Metadados:</span>
                  <pre className="p-2.5 rounded bg-muted/60 text-[11px] font-mono overflow-auto max-h-48 border">
                    {JSON.stringify(logInspecionado.detalhes_json, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

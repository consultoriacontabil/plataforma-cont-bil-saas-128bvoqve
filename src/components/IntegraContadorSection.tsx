import React, { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
  Server,
  Zap,
  Building2,
  HelpCircle,
  Layers,
  FileSpreadsheet,
  Activity,
  DollarSign,
  ArrowRight,
  Clock,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  integraContadorService,
  type IntegraContadorConfig,
  type TestarConexaoResult,
  type ResumoConsumoResult,
  type SincronizarLoteResult,
} from '@/services/integraContadorService'
import { certificadosService } from '@/services/certificados'
import { empresasService } from '@/services/empresas'
import type { CertificadoDigitalRecord, Empresa } from '@/types'
import { cn } from '@/lib/utils'

export function IntegraContadorSection() {
  const { tenant, member } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)

  // Config do Integra Contador
  const [config, setConfig] = useState<IntegraContadorConfig | null>(null)
  const [ativo, setAtivo] = useState(false)
  const [ambiente, setAmbiente] = useState<'trial' | 'producao'>('trial')
  const [consumerKey, setConsumerKey] = useState('')
  const [consumerSecret, setConsumerSecret] = useState('')
  const [contratanteCnpj, setContratanteCnpj] = useState('55.614.455/0001-99')
  const [autorPedidoDados, setAutorPedidoDados] = useState('55.614.455/0001-99')
  const [certificadoA1Id, setCertificadoA1Id] = useState<string>('')
  const [senhaCertificado, setSenhaCertificado] = useState('')
  const [proxyMtlsUrl, setProxyMtlsUrl] = useState('')

  // Toggles de sincronização
  const [syncAutomatica, setSyncAutomatica] = useState(true)
  const [syncSitFis, setSyncSitFis] = useState(true)
  const [syncCaixaPostal, setSyncCaixaPostal] = useState(true)
  const [syncDctfweb, setSyncDctfweb] = useState(true)
  const [syncPgdas, setSyncPgdas] = useState(true)

  // Controle de ofuscação (apenas últimos 4 caracteres visíveis por padrão)
  const [mostrarKey, setMostrarKey] = useState(false)
  const [mostrarSecret, setMostrarSecret] = useState(false)
  const [keyOriginal, setKeyOriginal] = useState('')
  const [secretOriginal, setSecretOriginal] = useState('')

  // Certificados e Empresas
  const [certificados, setCertificados] = useState<CertificadoDigitalRecord[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])

  // Resultados em tempo real
  const [ultimoDiagnostico, setUltimoDiagnostico] = useState<TestarConexaoResult | null>(null)
  const [resumoConsumo, setResumoConsumo] = useState<ResumoConsumoResult | null>(null)
  const [ultimoResultadoLote, setUltimoResultadoLote] = useState<SincronizarLoteResult | null>(null)

  const isPrivileged = member?.perfil === 'administrador' || member?.perfil === 'contador'

  // Carregar dados iniciais
  const carregarDados = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const [cfg, certs, emps, consumo] = await Promise.all([
        integraContadorService.getConfig(tenant.id),
        certificadosService.list(tenant.id),
        empresasService.list(tenant.id),
        integraContadorService.getResumoConsumo(tenant.id).catch(() => null),
      ])

      setCertificados(certs)
      setEmpresas(emps)
      setResumoConsumo(consumo)

      if (cfg) {
        setConfig(cfg)
        setAtivo(Boolean(cfg.ativo))
        setAmbiente(cfg.ambiente || 'trial')
        setKeyOriginal(cfg.consumer_key || '')
        setSecretOriginal(cfg.consumer_secret || '')
        setConsumerKey(cfg.consumer_key || '')
        setConsumerSecret(cfg.consumer_secret || '')
        setContratanteCnpj(cfg.contratante_cnpj || '55.614.455/0001-99')
        setAutorPedidoDados(
          cfg.autor_pedido_dados_numero || cfg.contratante_cnpj || '55.614.455/0001-99',
        )
        setCertificadoA1Id(cfg.certificado_a1 || '')
        setSenhaCertificado(cfg.senha_certificado || '')
        setProxyMtlsUrl(cfg.proxy_mtls_url || '')
        setSyncAutomatica(cfg.sincronizacao_automatica ?? true)
        setSyncSitFis(cfg.sincronizar_situacao_fiscal ?? true)
        setSyncCaixaPostal(cfg.sincronizar_caixa_postal ?? true)
        setSyncDctfweb(cfg.sincronizar_dctfweb ?? true)
        setSyncPgdas(cfg.sincronizar_pgdas ?? true)

        if (cfg.ultimo_diagnostico_json) {
          setUltimoDiagnostico(cfg.ultimo_diagnostico_json)
        }
      } else {
        // Tentar selecionar certificado da Rumo se houver
        const certRumo = certs.find((c) => c.titular.includes('55614455000199'))
        if (certRumo) {
          setCertificadoA1Id(certRumo.id)
          setSenhaCertificado('eykbA7ZX')
        }
      }
    } catch (err) {
      console.error('Erro ao carregar configurações do Integra Contador:', err)
      toast({
        variant: 'destructive',
        title: 'Erro de carregamento',
        description: 'Não foi possível carregar as credenciais do SERPRO.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, toast])

  useEffect(() => {
    void carregarDados()
  }, [carregarDados])

  // Máscara de exibição de credencial: se não estiver revelado, exibe apenas os 4 últimos
  const formatarCredencialOfuscada = (valor: string, revelado: boolean) => {
    if (!valor) return ''
    if (revelado) return valor
    if (valor.length <= 4) return '••••'
    const ultimos = valor.slice(-4)
    return `••••••••••••••••••••••••${ultimos}`
  }

  // Salvar configurações
  const handleSalvar = async () => {
    if (!tenant?.id) return
    setSalvando(true)
    try {
      const saved = await integraContadorService.saveConfig({
        tenant_id: tenant.id,
        ativo,
        ambiente,
        consumer_key: consumerKey.trim(),
        consumer_secret: consumerSecret.trim(),
        contratante_cnpj: contratanteCnpj.trim(),
        autor_pedido_dados_numero: autorPedidoDados.trim() || contratanteCnpj.trim(),
        certificado_a1: certificadoA1Id || undefined,
        senha_certificado: senhaCertificado,
        proxy_mtls_url: proxyMtlsUrl.trim(),
        sincronizacao_automatica: syncAutomatica,
        sincronizar_situacao_fiscal: syncSitFis,
        sincronizar_caixa_postal: syncCaixaPostal,
        sincronizar_dctfweb: syncDctfweb,
        sincronizar_pgdas: syncPgdas,
      })

      setConfig(saved)
      setKeyOriginal(saved.consumer_key)
      setSecretOriginal(saved.consumer_secret)

      toast({
        title: 'Configurações salvas!',
        description: 'Credenciais e diretivas do SERPRO Integra Contador atualizadas com sucesso.',
      })
    } catch (err: any) {
      console.error('Erro ao salvar config do Integra Contador:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: err?.message || 'Falha ao gravar configurações no banco de dados.',
      })
    } finally {
      setSalvando(false)
    }
  }

  // Executar Teste de Conexão Real
  const handleTestarConexao = async () => {
    if (!tenant?.id) return
    setTestando(true)
    try {
      const res = await integraContadorService.testarConexao({
        tenant_id: tenant.id,
        consumer_key: consumerKey.trim() || undefined,
        consumer_secret: consumerSecret.trim() || undefined,
        ambiente,
        contratante_cnpj: contratanteCnpj.trim() || undefined,
        autor_pedido_dados_numero: autorPedidoDados.trim() || undefined,
        proxy_mtls_url: proxyMtlsUrl.trim() || undefined,
        certificado_a1: certificadoA1Id || undefined,
      })

      setUltimoDiagnostico(res)

      // Atualizar config local
      if (config) {
        setConfig({
          ...config,
          status_conexao: res.status_conexao,
          ultimo_diagnostico_json: res,
        })
      }

      // Atualizar resumo de consumo (pois o teste é registrado)
      void integraContadorService.getResumoConsumo(tenant.id).then(setResumoConsumo)

      if (res.sucesso && res.credenciado) {
        toast({
          title: 'Conexão Testada com Sucesso!',
          description: res.mensagem,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Diagnóstico da Conexão',
          description: res.mensagem || 'Falha na validação das credenciais do SERPRO.',
        })
      }
    } catch (err: any) {
      console.error('Erro ao testar conexão:', err)
      toast({
        variant: 'destructive',
        title: 'Falha no teste de conexão',
        description: err?.message || 'Não foi possível contatar o gateway do SERPRO.',
      })
    } finally {
      setTestando(false)
    }
  }

  // Sincronizar Lote Agora
  const handleSincronizarLote = async () => {
    if (!tenant?.id) return
    setSincronizando(true)
    try {
      const res = await integraContadorService.sincronizarLote(tenant.id)
      setUltimoResultadoLote(res)

      // Recarregar resumo
      void integraContadorService.getResumoConsumo(tenant.id).then(setResumoConsumo)

      toast({
        title: 'Sincronização em Lote Concluída',
        description: `Processadas ${res.empresas_analisadas} empresas aptas (${res.empresas_sincronizadas} sincronizadas, ${res.empresas_com_erro_autorizacao} com pendência e-CAC).`,
      })
    } catch (err: any) {
      console.error('Erro ao sincronizar em lote:', err)
      toast({
        variant: 'destructive',
        title: 'Erro na sincronização',
        description: err?.message || 'Falha ao executar sincronização em lote.',
      })
    } finally {
      setSincronizando(false)
    }
  }

  // Atualizar Autorização de Empresa
  const handleAtualizarAutorizacao = async (
    empresaId: string,
    novoStatus: 'ativa' | 'em_analise' | 'vencida' | 'nao_solicitada',
  ) => {
    try {
      await integraContadorService.atualizarAutorizacaoEmpresa(empresaId, novoStatus)
      setEmpresas((prev) =>
        prev.map((e) => (e.id === empresaId ? { ...e, autorizacao_acesso_ecac: novoStatus } : e)),
      )
      toast({
        title: 'Autorização e-CAC atualizada',
        description: `Status alterado para "${novoStatus.replace('_', ' ')}".`,
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar autorização',
        description: err?.message || 'Falha na alteração do registro.',
      })
    }
  }

  // Badge de Autonomia Dinâmico
  const renderBadgeAutonomia = () => {
    const status = config?.status_conexao || ultimoDiagnostico?.status_conexao || 'desconectado'
    const temProxy = Boolean(proxyMtlsUrl && proxyMtlsUrl.trim().length >= 8)

    if (status === 'conectado' && temProxy) {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 px-3 py-1 font-semibold text-xs shadow-xs">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Automático (credenciado)</span>
        </Badge>
      )
    }

    if (status === 'modo_supervisao' || (status === 'conectado' && !temProxy)) {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5 px-3 py-1 font-semibold text-xs shadow-xs">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Modo Supervisão</span>
        </Badge>
      )
    }

    if (status === 'erro_credenciais') {
      return (
        <Badge variant="destructive" className="gap-1.5 px-3 py-1 font-semibold text-xs shadow-xs">
          <XCircle className="h-3.5 w-3.5" />
          <span>Credenciais Inválidas</span>
        </Badge>
      )
    }

    return (
      <Badge variant="outline" className="bg-slate-100 text-slate-600 gap-1.5 px-3 py-1 text-xs">
        <Clock className="h-3.5 w-3.5" />
        <span>Não Configurado</span>
      </Badge>
    )
  }

  // Badges coloridos de autorização e-CAC
  const renderBadgeAutorizacaoEcac = (status?: string) => {
    switch (status) {
      case 'ativa':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[11px] font-semibold">
            Ativa (Aceite Confirmado)
          </Badge>
        )
      case 'em_analise':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[11px] font-semibold animate-pulse">
            Em Análise (Aguardando Aceite)
          </Badge>
        )
      case 'vencida':
        return (
          <Badge variant="destructive" className="text-[11px] font-semibold">
            Vencida (&gt; 30 dias)
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-slate-50 text-slate-500 text-[11px]">
            Não Solicitada
          </Badge>
        )
    }
  }

  if (loading) {
    return (
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs p-6 bg-white">
        <div className="flex items-center justify-center py-10 gap-3 text-slate-500 text-sm">
          <RefreshCw className="h-5 w-5 animate-spin text-[#0FA3A3]" />
          <span>Carregando dados do conector SERPRO Integra Contador...</span>
        </div>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border-[#0FA3A3]/30 shadow-md bg-white overflow-hidden transition-all">
      {/* Header do Cartão */}
      <CardHeader className="bg-gradient-to-r from-teal-500/10 via-slate-50 to-white border-b border-slate-100 pb-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0FA3A3] to-[#123B6D] text-white shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base font-bold text-[#1A2333]">
                  Integra Contador (SERPRO / e-CAC Oficial)
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-teal-50 text-[#0FA3A3] border-[#0FA3A3]"
                >
                  API GOVERNO FEDERAL
                </Badge>
                {renderBadgeAutonomia()}
              </div>
              <CardDescription className="text-xs text-[#64748B] mt-1">
                Acesso oficial direto às bases da Receita Federal: Caixa Postal / Intimações DTE,
                Situação Fiscal (SITFIS), DCTFWeb e emissão de DAS no PGDAS-D via canal homologado
                SERPRO.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-700">Integração Ativa</span>
              <Switch
                checked={ativo}
                onCheckedChange={setAtivo}
                disabled={!isPrivileged || salvando}
                aria-label="Ativar Integra Contador"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <Tabs defaultValue="credenciais" className="w-full">
          <TabsList className="grid grid-cols-1 sm:grid-cols-3 bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="credenciais" className="text-xs font-semibold rounded-lg">
              Credenciais & Handshake
            </TabsTrigger>
            <TabsTrigger value="consumo" className="text-xs font-semibold rounded-lg">
              Consumo do Mês
            </TabsTrigger>
            <TabsTrigger value="autorizacoes" className="text-xs font-semibold rounded-lg">
              Autorizações e-CAC ({empresas.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: FORMULÁRIO DE CREDENCIAIS & HANDSHAKE */}
          <TabsContent value="credenciais" className="space-y-6 mt-4">
            {/* Aviso sobre Modo Supervisão vs Túnel mTLS */}
            {!proxyMtlsUrl && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Modo Supervisão Ativo</p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    As credenciais OAuth2 conectam com o gateway do SERPRO. Entretanto, sem o
                    <strong> Proxy mTLS</strong> configurado para anexar o Certificado A1 cliente no
                    handshake TLS, consultas que exigem assinatura mTLS (SITFIS/DCTFWeb/PGDASD)
                    serão auditadas com transparência em modo supervisão.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Ambiente */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Ambiente SERPRO</Label>
                <Select
                  value={ambiente}
                  onValueChange={(val: 'trial' | 'producao') => setAmbiente(val)}
                  disabled={!isPrivileged}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Selecione o ambiente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">
                      Trial (Homologação / Demonstração Gratuita)
                    </SelectItem>
                    <SelectItem value="producao">Produção Oficial SERPRO</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500">
                  Utilize Trial para testes com credenciais geradas na Loja SERPRO sem tarifação.
                </p>
              </div>

              {/* CNPJ do Contratante */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  CNPJ do Escritório Contratante
                </Label>
                <Input
                  value={contratanteCnpj}
                  onChange={(e) => setContratanteCnpj(e.target.value)}
                  placeholder="55.614.455/0001-99"
                  disabled={!isPrivileged}
                  className="h-9 text-xs rounded-xl font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  CNPJ titular do contrato na Loja SERPRO (Rumo Consultoria Contábil).
                </p>
              </div>

              {/* Consumer Key */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Consumer Key</span>
                  <button
                    type="button"
                    onClick={() => setMostrarKey(!mostrarKey)}
                    className="text-[10px] text-teal-700 hover:underline flex items-center gap-1 font-normal"
                  >
                    {mostrarKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{mostrarKey ? 'Ocultar' : 'Exibir chave'}</span>
                  </button>
                </Label>
                <div className="relative">
                  <Input
                    type={mostrarKey ? 'text' : 'password'}
                    value={
                      mostrarKey ? consumerKey : formatarCredencialOfuscada(consumerKey, false)
                    }
                    onChange={(e) => {
                      setConsumerKey(e.target.value)
                    }}
                    onFocus={() => {
                      if (!mostrarKey && consumerKey === keyOriginal) {
                        setMostrarKey(true)
                      }
                    }}
                    placeholder="Chave Consumer gerada na Loja SERPRO"
                    disabled={!isPrivileged}
                    className="h-9 text-xs rounded-xl font-mono pr-9"
                  />
                  <div className="absolute right-3 top-2.5 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Apenas os últimos 4 dígitos são expostos na interface para segurança da API.
                </p>
              </div>

              {/* Consumer Secret */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Consumer Secret</span>
                  <button
                    type="button"
                    onClick={() => setMostrarSecret(!mostrarSecret)}
                    className="text-[10px] text-teal-700 hover:underline flex items-center gap-1 font-normal"
                  >
                    {mostrarSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{mostrarSecret ? 'Ocultar' : 'Exibir chave'}</span>
                  </button>
                </Label>
                <div className="relative">
                  <Input
                    type={mostrarSecret ? 'text' : 'password'}
                    value={
                      mostrarSecret
                        ? consumerSecret
                        : formatarCredencialOfuscada(consumerSecret, false)
                    }
                    onChange={(e) => {
                      setConsumerSecret(e.target.value)
                    }}
                    onFocus={() => {
                      if (!mostrarSecret && consumerSecret === secretOriginal) {
                        setMostrarSecret(true)
                      }
                    }}
                    placeholder="Segredo Consumer do SERPRO"
                    disabled={!isPrivileged}
                    className="h-9 text-xs rounded-xl font-mono pr-9"
                  />
                  <div className="absolute right-3 top-2.5 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Utilizado para obter token OAuth2 dinâmico junto ao SERPRO.
                </p>
              </div>

              {/* Autor Pedido Dados Número */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Autor do Pedido de Dados (CPF/CNPJ)
                </Label>
                <Input
                  value={autorPedidoDados}
                  onChange={(e) => setAutorPedidoDados(e.target.value)}
                  placeholder="55.614.455/0001-99"
                  disabled={!isPrivileged}
                  className="h-9 text-xs rounded-xl font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  CNPJ ou CPF do procurador credenciado junto à Receita Federal.
                </p>
              </div>

              {/* Certificado Digital e-CNPJ A1 do Cofre */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Certificado e-CNPJ A1 do Escritório (Cofre)
                </Label>
                <Select
                  value={certificadoA1Id}
                  onValueChange={setCertificadoA1Id}
                  disabled={!isPrivileged}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Selecione o certificado do cofre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum certificado vinculado</SelectItem>
                    {certificados.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.titular} (Vence: {c.validade?.slice(0, 10)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500">
                  Certificado digital A1 da contabilidade utilizado para assinar requisições mTLS.
                </p>
              </div>

              {/* Senha do Certificado */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Senha do Certificado A1
                </Label>
                <Input
                  type="password"
                  value={senhaCertificado}
                  onChange={(e) => setSenhaCertificado(e.target.value)}
                  placeholder="Senha do arquivo .pfx"
                  disabled={!isPrivileged}
                  className="h-9 text-xs rounded-xl font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  Armazenada no cofre para descriptografia da chave privada do e-CNPJ.
                </p>
              </div>

              {/* Proxy mTLS URL */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Túnel / Proxy mTLS URL
                </Label>
                <Input
                  value={proxyMtlsUrl}
                  onChange={(e) => setProxyMtlsUrl(e.target.value)}
                  placeholder="https://mtls-proxy.rumoconsultoria.com.br"
                  disabled={!isPrivileged}
                  className="h-9 text-xs rounded-xl font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  Ponto de terminação mTLS SERPRO para injeção de certificado cliente A1.
                </p>
              </div>
            </div>

            {/* Toggles de Sincronização por Serviço */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#0FA3A3]" />
                <span>Serviços Autorizados para Sincronização Contínua</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Sincronização Automática</p>
                    <p className="text-[10px] text-slate-500">Job agendado diário às 04:30</p>
                  </div>
                  <Switch
                    checked={syncAutomatica}
                    onCheckedChange={setSyncAutomatica}
                    disabled={!isPrivileged}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Situação Fiscal (SITFIS)</p>
                    <p className="text-[10px] text-slate-500">Débitos e pendências da RFB</p>
                  </div>
                  <Switch
                    checked={syncSitFis}
                    onCheckedChange={setSyncSitFis}
                    disabled={!isPrivileged}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Caixa Postal (DTE)</p>
                    <p className="text-[10px] text-slate-500">Mensagens e intimações fiscais</p>
                  </div>
                  <Switch
                    checked={syncCaixaPostal}
                    onCheckedChange={setSyncCaixaPostal}
                    disabled={!isPrivileged}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">DCTFWeb</p>
                    <p className="text-[10px] text-slate-500">Declarações e saldos a pagar</p>
                  </div>
                  <Switch
                    checked={syncDctfweb}
                    onCheckedChange={setSyncDctfweb}
                    disabled={!isPrivileged}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">PGDAS-D</p>
                    <p className="text-[10px] text-slate-500">Apuração e emissão do DAS</p>
                  </div>
                  <Switch
                    checked={syncPgdas}
                    onCheckedChange={setSyncPgdas}
                    disabled={!isPrivileged}
                  />
                </div>
              </div>
            </div>

            {/* Painel do Último Diagnóstico Real */}
            {ultimoDiagnostico && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-[#0FA3A3]" />
                    <span className="text-xs font-bold text-slate-800">
                      Diagnóstico Real do Gateway SERPRO
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Verificado em:{' '}
                    {new Date(ultimoDiagnostico.verificado_em).toLocaleString('pt-BR')} (
                    {ultimoDiagnostico.duracao_ms}ms)
                  </span>
                </div>

                <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  {ultimoDiagnostico.mensagem}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ultimoDiagnostico.itens?.map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-start gap-2 p-2 rounded-lg border text-xs',
                        item.status === 'ok'
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                          : item.status === 'alerta'
                            ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                            : 'bg-rose-50/60 border-rose-200 text-rose-900',
                      )}
                    >
                      {item.status === 'ok' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : item.status === 'alerta' ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-semibold text-[11px]">{item.item}</p>
                        <p className="text-[10px] opacity-90">{item.detalhe}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ações: Salvar, Testar e Sincronizar Lote */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleTestarConexao}
                  disabled={testando || salvando || sincronizando}
                  variant="outline"
                  className="gap-2 h-9 text-xs rounded-xl font-semibold border-teal-600 text-teal-700 hover:bg-teal-50"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', testando && 'animate-spin')} />
                  <span>{testando ? 'Testando no SERPRO...' : 'Testar Conexão'}</span>
                </Button>

                <Button
                  onClick={handleSincronizarLote}
                  disabled={sincronizando || testando || salvando || !ativo}
                  variant="outline"
                  className="gap-2 h-9 text-xs rounded-xl font-semibold border-slate-300 hover:bg-slate-50 text-slate-700"
                >
                  <Activity
                    className={cn('h-3.5 w-3.5 text-[#0FA3A3]', sincronizando && 'animate-spin')}
                  />
                  <span>{sincronizando ? 'Sincronizando Empresas...' : 'Sincronizar Agora'}</span>
                </Button>
              </div>

              <Button
                onClick={handleSalvar}
                disabled={salvando || testando || !isPrivileged}
                className="gap-2 h-9 text-xs rounded-xl font-semibold bg-[#0FA3A3] hover:bg-[#0c8282] text-white shadow-xs"
              >
                <span>{salvando ? 'Salvando...' : 'Salvar Alterações'}</span>
              </Button>
            </div>
          </TabsContent>

          {/* TAB 2: PAINEL DE CONSUMO DO MÊS */}
          <TabsContent value="consumo" className="space-y-5 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total de Chamadas
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {resumoConsumo?.total_chamadas ?? 0}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Mês de referência: {resumoConsumo?.mes_referencia || '2026-10'}
                </p>
              </Card>

              <Card className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Custo Estimado Acumulado
                </p>
                <p className="text-2xl font-bold text-teal-700 mt-1">
                  R$ {(resumoConsumo?.total_custo_estimado ?? 0).toFixed(2)}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Tarifa SERPRO apurada</p>
              </Card>

              <Card className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Chamadas Oficiais SERPRO
                </p>
                <p className="text-2xl font-bold text-emerald-700 mt-1">
                  {resumoConsumo?.chamadas_oficiais ?? 0}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Via canal direto autenticado</p>
              </Card>

              <Card className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Modo Supervisão
                </p>
                <p className="text-2xl font-bold text-amber-600 mt-1">
                  {resumoConsumo?.chamadas_supervisao ?? 0}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Pré-testes &amp; diagnósticos</p>
              </Card>
            </div>

            {/* Tabela de Consumo por Serviço SERPRO */}
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Discriminação por Serviço Oficial SERPRO
                </span>
                <span className="text-[11px] text-slate-500">Mês vigente</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-3">Serviço</th>
                      <th className="py-2.5 px-3">Finalidade</th>
                      <th className="py-2.5 px-3 text-center">Chamadas</th>
                      <th className="py-2.5 px-3 text-center">Sucessos</th>
                      <th className="py-2.5 px-3 text-center">Erros / Bloqueios</th>
                      <th className="py-2.5 px-3 text-right">Custo Est. (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {[
                      {
                        sigla: 'SITFIS',
                        nome: 'Situação Fiscal',
                        desc: 'Débitos fiscais, pendências e CND',
                        dados: resumoConsumo?.servicos.SITFIS,
                      },
                      {
                        sigla: 'CAIXAPOSTAL',
                        nome: 'Caixa Postal RFB',
                        desc: 'Intimações e comunicados DTE',
                        dados: resumoConsumo?.servicos.CAIXAPOSTAL,
                      },
                      {
                        sigla: 'DCTFWEB',
                        nome: 'DCTFWeb',
                        desc: 'Declarações e saldos previdenciários',
                        dados: resumoConsumo?.servicos.DCTFWEB,
                      },
                      {
                        sigla: 'PGDASD',
                        nome: 'PGDAS-D',
                        desc: 'Apuração mensal e emissão de DAS',
                        dados: resumoConsumo?.servicos.PGDASD,
                      },
                      {
                        sigla: 'TESTE_CONEXAO',
                        nome: 'Diagnóstico & Teste',
                        desc: 'Validação de credenciais e túnel mTLS',
                        dados: resumoConsumo?.servicos.TESTE_CONEXAO,
                      },
                    ].map((row) => (
                      <tr key={row.sigla} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900">{row.sigla}</span>
                          <span className="block text-[10px] text-slate-500">{row.nome}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{row.desc}</td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-800">
                          {row.dados?.qtd ?? 0}
                        </td>
                        <td className="py-3 px-3 text-center text-emerald-600">
                          {row.dados?.sucessos ?? 0}
                        </td>
                        <td className="py-3 px-3 text-center text-rose-600">
                          {row.dados?.erros ?? 0}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-900">
                          R$ {(row.dados?.custo ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: AUTORIZAÇÕES DE ACESSO E-CAC POR EMPRESA */}
          <TabsContent value="autorizacoes" className="space-y-4 mt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-teal-50/50 p-3 rounded-xl border border-teal-200">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#0FA3A3]" />
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Gestão de Procurações e Autorizações Eletrônicas e-CAC
                  </p>
                  <p className="text-[11px] text-slate-600">
                    O contribuinte deve autorizar o CNPJ do escritório no e-CAC em até 30 dias para
                    liberação das consultas automáticas.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSincronizarLote}
                disabled={sincronizando || !ativo}
                className="text-xs h-8 rounded-lg shrink-0 border-teal-600 text-teal-700 hover:bg-teal-100"
              >
                <Activity className={cn('h-3.5 w-3.5 mr-1.5', sincronizando && 'animate-spin')} />
                <span>Testar Autorizações Ativas</span>
              </Button>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-3">Empresa / Razão Social</th>
                      <th className="py-2.5 px-3">CNPJ</th>
                      <th className="py-2.5 px-3">Status Autorização e-CAC</th>
                      <th className="py-2.5 px-3">Observações / Instruções</th>
                      <th className="py-2.5 px-3 text-right">Ação Rápida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {empresas.map((emp) => {
                      const statusAut = emp.autorizacao_acesso_ecac || 'nao_solicitada'
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900 block">
                              {emp.razao_social}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {emp.nome_fantasia || 'Sem nome fantasia'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-700">{emp.cnpj}</td>
                          <td className="py-3 px-3">{renderBadgeAutorizacaoEcac(statusAut)}</td>
                          <td className="py-3 px-3 max-w-xs text-[11px] text-slate-600">
                            {statusAut === 'em_analise' ? (
                              <span className="text-amber-800 font-semibold flex items-center gap-1">
                                <Clock className="h-3 w-3 text-amber-600 shrink-0" />
                                Confirme o aceite no e-CAC em até 30 dias
                              </span>
                            ) : emp.autorizacao_acesso_observacao ? (
                              <span className="line-clamp-2">
                                {emp.autorizacao_acesso_observacao}
                              </span>
                            ) : (
                              <span className="text-slate-400">Regular</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <Select
                              value={statusAut}
                              onValueChange={(val: any) => handleAtualizarAutorizacao(emp.id, val)}
                              disabled={!isPrivileged}
                            >
                              <SelectTrigger className="h-7 text-[11px] rounded-lg w-32 ml-auto">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ativa">Ativa</SelectItem>
                                <SelectItem value="em_analise">Em Análise</SelectItem>
                                <SelectItem value="vencida">Vencida</SelectItem>
                                <SelectItem value="nao_solicitada">Não Solicitada</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resultado do último lote executado */}
            {ultimoResultadoLote && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                <p className="font-bold text-slate-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Resultado da Última Sincronização em Lote</span>
                </p>
                <p className="text-slate-600 text-[11px]">
                  Empresas analisadas: {ultimoResultadoLote.empresas_analisadas} | Sincronizadas com
                  sucesso: {ultimoResultadoLote.empresas_sincronizadas} | Pendências de autorização:{' '}
                  {ultimoResultadoLote.empresas_com_erro_autorizacao}
                </p>
                <div className="space-y-1 pt-1">
                  {ultimoResultadoLote.detalhes.map((det) => (
                    <div
                      key={det.empresa_id}
                      className="flex items-center justify-between p-1.5 rounded bg-white border border-slate-200 text-[11px]"
                    >
                      <span className="font-semibold text-slate-800">{det.razao_social}</span>
                      <span className="text-slate-500 font-mono text-[10px]">{det.cnpj}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          det.status === 'sucesso'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-amber-50 text-amber-700 border-amber-300',
                        )}
                      >
                        {det.status === 'sucesso' ? 'Sincronizado' : det.motivo || det.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

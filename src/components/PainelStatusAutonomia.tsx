import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { whatsappAtivoService } from '@/services/whatsappAtivo'
import { certificadosService } from '@/services/certificados'
import { nfseWhatsappService } from '@/services/nfseWhatsapp'
import pb from '@/lib/pocketbase/client'
import type { WhatsAppEnvioRecord } from '@/types'
import {
  ShieldCheck,
  ShieldAlert,
  Bot,
  KeyRound,
  ExternalLink,
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Zap,
  Info,
  Radio,
  FileCheck2,
  ArrowRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface PainelStatusAutonomiaProps {
  tenantId: string
  canManage?: boolean
}

interface StatusEvolutionState {
  configurado: boolean
  url: string
  instance: string
  ultimoTeste?: {
    sucesso?: boolean
    status?: string
    mensagem?: string
    data?: string
  } | null
  dataUltimoTeste?: string
}

interface StatusCertificadosState {
  total: number
  ativos: number
  vencidos: number
  aVencer30d: number
  proximoVencimento?: {
    titular: string
    empresaNome?: string
    validade: string
    diasRestantes: number
  } | null
}

export function PainelStatusAutonomia({ tenantId, canManage = false }: PainelStatusAutonomiaProps) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [despachando, setDespachando] = useState(false)
  const [testandoEvo, setTestandoEvo] = useState(false)

  // Status Evolution API
  const [evoStatus, setEvoStatus] = useState<StatusEvolutionState>({
    configurado: false,
    url: '',
    instance: '',
  })

  // Fila retida em aguardando credenciais
  const [filaRetida, setFilaRetida] = useState<{
    total: number
    itens: WhatsAppEnvioRecord[]
  }>({ total: 0, itens: [] })

  // Status Certificados Digitais
  const [certStatus, setCertStatus] = useState<StatusCertificadosState>({
    total: 0,
    ativos: 0,
    vencidos: 0,
    aVencer30d: 0,
    proximoVencimento: null,
  })

  // Carregar dados de verdade do tenant
  const carregarDados = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [evoData, filaData, certData] = await Promise.all([
        whatsappAtivoService.getStatusEvolutionTenant(tenantId),
        whatsappAtivoService.getFilaAguardandoCredenciais(tenantId),
        certificadosService.getStatusCertificadosTenant(tenantId),
      ])

      setEvoStatus(evoData)
      setFilaRetida(filaData)
      setCertStatus(certData)
    } catch (err) {
      console.error('Erro ao carregar status de autonomia:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível ler as credenciais reais do tenant.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Despachar a fila retida
  const handleDespacharFila = async () => {
    if (!canManage) {
      toast({
        variant: 'destructive',
        title: 'Acesso restrito',
        description: 'Apenas administradores e contadores podem despachar a fila.',
      })
      return
    }

    if (!evoStatus.configurado) {
      toast({
        variant: 'destructive',
        title: 'Credenciais ausentes',
        description:
          'Configure uma URL e API Key válidas da Evolution API antes de despachar a fila.',
      })
      return
    }

    setDespachando(true)
    try {
      const res = await whatsappAtivoService.despacharFilaRetida(tenantId)
      if (res.sucesso) {
        toast({
          title: 'Fila despachada!',
          description: res.mensagem,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Despacho com ressalvas',
          description: res.mensagem || 'Alguns itens não puderam ser enviados.',
        })
      }
      carregarDados()
    } catch (err: any) {
      console.error('Erro ao despachar fila:', err)
      toast({
        variant: 'destructive',
        title: 'Erro no despacho',
        description:
          err?.data?.erro ||
          err?.message ||
          'Falha de comunicação com o servidor ao despachar fila.',
      })
    } finally {
      setDespachando(false)
    }
  }

  // Testar conexão da Evolution API sob demanda
  const handleTestarEvolution = async () => {
    if (!canManage) return
    setTestandoEvo(true)
    try {
      // Ler do banco a chave crua
      const cfg = await pb.collection('nfse_config').getFirstListItem(`tenant_id = "${tenantId}"`)
      const url = cfg.get('evolution_api_url') as string
      const key = cfg.get('evolution_api_key') as string
      const instance = cfg.get('evolution_instance') as string

      if (!url || !key || !instance) {
        toast({
          variant: 'destructive',
          title: 'Credenciais incompletas',
          description: 'URL, Chave ou Instância não preenchidas no tenant.',
        })
        return
      }

      const res = await nfseWhatsappService.testarConexaoEvolution(url, key, instance)
      if (res.sucesso) {
        // Atualiza no banco o último teste para manter coerência
        await pb.collection('nfse_config').update(cfg.id, {
          ultimo_teste_evolution: {
            sucesso: true,
            status: 'conectado',
            mensagem: 'Conexão validada com sucesso pelo painel de Autonomia.',
            data: new Date().toISOString(),
          },
        })
        toast({
          title: 'Evolution API Conectada!',
          description: 'A instância respondeu positivamente aos testes.',
        })
      } else {
        await pb.collection('nfse_config').update(cfg.id, {
          ultimo_teste_evolution: {
            sucesso: false,
            status: 'erro',
            mensagem: res.mensagem || 'Falha na conexão.',
            data: new Date().toISOString(),
          },
        })
        toast({
          variant: 'destructive',
          title: 'Falha no teste',
          description: res.mensagem,
        })
      }
      carregarDados()
    } catch (err: any) {
      console.error('Erro ao testar:', err)
      toast({
        variant: 'destructive',
        title: 'Erro de conexão',
        description: err?.message || 'Não foi possível contatar o serviço.',
      })
    } finally {
      setTestandoEvo(false)
    }
  }

  // Nível global derivado
  const evoAutonomo = evoStatus.configurado
  const certAutonomo = certStatus.ativos > 0

  return (
    <div className="space-y-6">
      {/* Banner de Governança e Autonomia da ELLIZA */}
      <div className="rounded-2xl border border-teal-200/60 bg-gradient-to-r from-[#0B1F3A] via-[#0F3159] to-[#0B1F3A] text-white p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-teal-500/10 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/20 border border-teal-400/30 text-teal-300">
                <Bot className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-bold tracking-tight">
                Status de Autonomia & Credenciais Operacionais
              </h2>
              {evoAutonomo && certAutonomo ? (
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                  Operação Hiperautomatizada Ativa
                </Badge>
              ) : (
                <Badge className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-semibold">
                  Modo Supervisão Parcial (Auditoria Preventiva)
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              A ELLIZA opera como motor autônomo baseado em evidências reais. Quando as credenciais
              estão ausentes ou em validação, o sistema <b>restringe execuções automáticas</b> e
              mantém o escritório em <b>Modo Supervisão Humana</b>, retendo filas e exigindo
              chancela do contador para blindagem fiscal e trabalhista.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={carregarDados}
              disabled={loading}
              className="h-9 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              <span>{loading ? 'Consultando...' : 'Atualizar Diagnóstico'}</span>
            </Button>
          </div>
        </div>

        {/* Barra de Indicadores Rápidos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/10 text-xs">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-3 w-3 rounded-full',
                evoAutonomo ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400',
              )}
            />
            <div>
              <p className="font-semibold text-slate-200">Evolution API / WhatsApp</p>
              <p className="text-[11px] text-slate-400">
                {evoAutonomo ? 'Automático (credenciado)' : 'Modo Supervisão (fila retida)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-3 w-3 rounded-full',
                certAutonomo ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400',
              )}
            />
            <div>
              <p className="font-semibold text-slate-200">Certificados e-CNPJ A1</p>
              <p className="text-[11px] text-slate-400">
                {certAutonomo
                  ? `${certStatus.ativos} certificado(s) ativo(s)`
                  : 'Nenhum certificado ativo no cofre'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-3 w-3 rounded-full',
                filaRetida.total > 0 ? 'bg-amber-400' : 'bg-emerald-400',
              )}
            />
            <div>
              <p className="font-semibold text-slate-200">Fila Retida em Supervisão</p>
              <p className="text-[11px] text-slate-400">
                {filaRetida.total > 0
                  ? `${filaRetida.total} item(ns) aguardando credenciais`
                  : 'Fila limpa / despachada'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid das Integrações Credenciadas Reais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* =========================================================================
            CARD 1: EVOLUTION API / WHATSAPP ATIVO
           ========================================================================= */}
        <Card className="rounded-2xl border-slate-200 shadow-2xs flex flex-col">
          <CardHeader className="p-5 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-teal-100 text-[#0FA3A3] flex items-center justify-center">
                    <Radio className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Evolution API • Mensageria Ativa & Alertas
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Disparo de cobranças PIX, guias de tributos (DAS/DARF) e avisos 24/7
                    </CardDescription>
                  </div>
                </div>
              </div>

              {evoAutonomo ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-semibold gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Automático (credenciado)
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs font-semibold gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  Modo Supervisão
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-5 flex-1 space-y-4 text-xs">
            {/* Diagnóstico de dados reais */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-white">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-semibold text-slate-600">Instância Registrada:</span>
                <span className="font-mono font-bold text-slate-900">
                  {evoStatus.instance || 'Não informada'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-semibold text-slate-600">Servidor Endpoint:</span>
                <span
                  className="font-mono text-slate-700 truncate max-w-[220px]"
                  title={evoStatus.url}
                >
                  {evoStatus.url || 'Não informado'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-semibold text-slate-600">Último Teste de Conexão:</span>
                <span className="text-slate-800">
                  {evoStatus.ultimoTeste?.sucesso ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Conectado com sucesso
                    </span>
                  ) : evoStatus.ultimoTeste?.mensagem ? (
                    <span className="text-rose-600 font-semibold flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> {evoStatus.ultimoTeste.mensagem}
                    </span>
                  ) : (
                    <span className="text-slate-400">Nenhum teste recente gravado</span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600">Regime de Operação:</span>
                <span className="font-medium text-slate-900">
                  {evoAutonomo
                    ? 'Disparo contínuo sem retenção manual'
                    : 'Modo Supervisão (mensagens aguardam liberação)'}
                </span>
              </div>
            </div>

            {/* Caixa da Fila Retida */}
            <div
              className={cn(
                'rounded-xl p-4 border space-y-3 transition-colors',
                filaRetida.total > 0
                  ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                  : 'bg-emerald-50/50 border-emerald-200 text-emerald-950',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock
                    className={cn(
                      'h-4 w-4',
                      filaRetida.total > 0 ? 'text-amber-600' : 'text-emerald-600',
                    )}
                  />
                  <span className="font-bold">
                    Fila Retida em &quot;Aguardando Credenciais&quot;
                  </span>
                </div>
                <Badge
                  className={cn(
                    'font-mono font-bold',
                    filaRetida.total > 0
                      ? 'bg-amber-200 text-amber-900 border-amber-300'
                      : 'bg-emerald-200 text-emerald-900 border-emerald-300',
                  )}
                >
                  {filaRetida.total} item(ns)
                </Badge>
              </div>

              <p className="text-[11px] text-slate-600">
                {filaRetida.total > 0
                  ? 'Mensagens geradas pela ELLIZA retidas para evitar erros de conexão. Quando as credenciais forem validadas, use o botão abaixo para dispará-las.'
                  : 'Nenhum envio retido no momento. Todas as mensagens ativas foram despachadas ou não há fila pendente.'}
              </p>

              {filaRetida.total > 0 && (
                <div className="pt-2 border-t border-amber-200/60 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <span className="text-[11px] text-amber-800 font-medium">
                    Endpoint:{' '}
                    <code className="text-[10px] bg-amber-100 px-1 py-0.5 rounded">
                      /backend/v1/whatsapp-ativo/despachar-fila
                    </code>
                  </span>

                  <Button
                    size="sm"
                    onClick={handleDespacharFila}
                    disabled={despachando || !canManage}
                    className="w-full sm:w-auto h-8 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-xs"
                  >
                    <Send className={cn('h-3.5 w-3.5', despachando && 'animate-spin')} />
                    <span>{despachando ? 'Despachando Fila...' : 'Despachar Fila Agora'}</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Ações de Gestão & Atalho */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {canManage && evoStatus.configurado && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleTestarEvolution}
                    disabled={testandoEvo}
                    className="h-8 text-xs font-semibold rounded-xl border-slate-200 gap-1.5"
                  >
                    <RefreshCw className={cn('h-3 w-3', testandoEvo && 'animate-spin')} />
                    <span>{testandoEvo ? 'Testando...' : 'Testar Conexão'}</span>
                  </Button>
                )}
              </div>

              <Link
                to="/integracoes"
                className="text-xs text-[#0FA3A3] hover:text-[#0c8585] font-semibold flex items-center gap-1.5 hover:underline"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Configurar em Integrações → NFS-e & WhatsApp</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* =========================================================================
            CARD 2: CERTIFICADOS DIGITAIS E-CNPJ A1
           ========================================================================= */}
        <Card className="rounded-2xl border-slate-200 shadow-2xs flex flex-col">
          <CardHeader className="p-5 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <FileCheck2 className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Certificados Digitais e-CNPJ A1
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Assinatura de transmissões oficiais: e-Social, DCTFWeb, EFD-Reinf e SPED
                    </CardDescription>
                  </div>
                </div>
              </div>

              {certAutonomo ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-semibold gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Automático (credenciado)
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs font-semibold gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  Modo Supervisão
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-5 flex-1 space-y-4 text-xs">
            {/* Diagnóstico de dados reais do cofre */}
            <div className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-white">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-semibold text-slate-600">
                  Total de Certificados no Cofre:
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {certStatus.total} cadastrado(s)
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-semibold text-slate-600">Certificados Válidos & Ativos:</span>
                <span className="text-emerald-700 font-bold font-mono">
                  {certStatus.ativos} ativo(s)
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-semibold text-slate-600">A Vencer nos Próximos 30 Dias:</span>
                <span
                  className={cn(
                    'font-mono font-bold',
                    certStatus.aVencer30d > 0 ? 'text-amber-600' : 'text-slate-700',
                  )}
                >
                  {certStatus.aVencer30d} alerta(s)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600">Expirados / Vencidos:</span>
                <span
                  className={cn(
                    'font-mono font-bold',
                    certStatus.vencidos > 0 ? 'text-rose-600' : 'text-slate-700',
                  )}
                >
                  {certStatus.vencidos} certificado(s)
                </span>
              </div>
            </div>

            {/* Destaque do Próximo Vencimento */}
            {certStatus.proximoVencimento ? (
              <div className="rounded-xl p-4 border border-blue-200 bg-blue-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-blue-600" />
                    Próximo Vencimento Identificado
                  </span>
                  <Badge
                    className={cn(
                      'text-[10px] font-bold',
                      certStatus.proximoVencimento.diasRestantes <= 15
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-blue-100 text-blue-800 border-blue-300',
                    )}
                  >
                    {certStatus.proximoVencimento.diasRestantes} dia(s) restante(s)
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-700">
                  <b>{certStatus.proximoVencimento.titular}</b>
                  {certStatus.proximoVencimento.empresaNome && (
                    <span> ({certStatus.proximoVencimento.empresaNome})</span>
                  )}
                </p>
                <p className="text-[10px] text-slate-500">
                  Data de validade:{' '}
                  {new Date(certStatus.proximoVencimento.validade).toLocaleDateString('pt-BR')}
                </p>
              </div>
            ) : (
              <div className="rounded-xl p-4 border border-slate-200 bg-slate-50 text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-slate-500" />
                  Nenhum certificado A1 registrado
                </p>
                <p className="text-[11px] text-slate-500">
                  Empresas sem certificado A1 operam estritamente sob Modo Supervisão para envio de
                  e-Social, Reinf e declarações federais.
                </p>
              </div>
            )}

            {/* Ações de Gestão & Atalho */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Cofre Seguro com criptografia AES e isolamento por tenant.
              </span>

              <Link
                to="/obrigacoes"
                className="text-xs text-[#0FA3A3] hover:text-[#0c8585] font-semibold flex items-center gap-1.5 hover:underline"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Gerenciar Cofre de Certificados</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Transmissões e Impacto Operacional */}
      <Card className="rounded-2xl border-slate-200 shadow-2xs">
        <CardHeader className="p-5 border-b border-slate-100 bg-slate-50/60">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Impacto da Autonomia por Módulo & Rotina
          </CardTitle>
          <CardDescription className="text-xs">
            Como cada frente do sistema reage ao status atual das credenciais da carteira
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0]">
                <tr>
                  <th className="py-3 px-4">Rotina / Módulo</th>
                  <th className="py-3 px-4">Dependência Legal</th>
                  <th className="py-3 px-4">Status Atual</th>
                  <th className="py-3 px-4">Comportamento Ativo</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                <tr className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    e-Social (S-1.1) • DP & Admissões
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">Certificado e-CNPJ A1 da Empresa</td>
                  <td className="py-3.5 px-4">
                    {certAutonomo ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold">
                        Automático (credenciado)
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">
                        Modo Supervisão
                      </Badge>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                    {certAutonomo
                      ? 'Transmissões assinadas automaticamente com recibo governamental.'
                      : 'XMLs validados e fila supervisionada aguardando chancela humana.'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      to="/departamento-pessoal"
                      className="text-[#0FA3A3] hover:underline font-semibold"
                    >
                      Acessar DP
                    </Link>
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    EFD-Reinf & DCTFWeb (v2.01)
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">Certificado e-CNPJ A1 da Empresa</td>
                  <td className="py-3.5 px-4">
                    {certAutonomo ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold">
                        Automático (credenciado)
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">
                        Modo Supervisão
                      </Badge>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                    {certAutonomo
                      ? 'Consolidação de retenções e transmissão do DARF integrada.'
                      : 'Cálculo de débitos unificados com travas e protocolo assistido.'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      to="/departamento-pessoal"
                      className="text-[#0FA3A3] hover:underline font-semibold"
                    >
                      Acessar Reinf
                    </Link>
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    SPED Contábil (ECD) / Fiscal (EFD)
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">e-CNPJ A1 + Assinador RFB/PVA</td>
                  <td className="py-3.5 px-4">
                    {certAutonomo ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold">
                        Automático (credenciado)
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">
                        Modo Supervisão
                      </Badge>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                    Compilação automática com hash MD5 e exportação estruturada.
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link to="/fiscal" className="text-[#0FA3A3] hover:underline font-semibold">
                      Acessar Fiscal
                    </Link>
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    Notificações Ativas & Cobrança WhatsApp
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">Evolution API (URL + API Key)</td>
                  <td className="py-3.5 px-4">
                    {evoAutonomo ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold">
                        Automático (credenciado)
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">
                        Modo Supervisão
                      </Badge>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                    {evoAutonomo
                      ? 'Mensagens despachadas diretamente para os clientes.'
                      : 'Fila retida aguardando credenciais. Despacho sob demanda habilitado.'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      to="/portal-acessos"
                      className="text-[#0FA3A3] hover:underline font-semibold"
                    >
                      Acessar Envios
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

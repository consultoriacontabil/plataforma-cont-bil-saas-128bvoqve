import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Database,
  FolderArchive,
  Download,
  Play,
  RotateCw,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Shield,
  Layers,
  Archive,
  Info,
  ExternalLink,
  ChevronRight,
  Loader2,
  HardDrive,
  Lock,
  Sliders,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { backupService } from '@/services/backup'
import { formatDateTimePtBr } from '@/lib/formatters'
import type { BackupExecucaoRecord } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'

export default function BackupPage() {
  const { tenant, member, user } = useAuth()
  const { toast } = useToast()

  const [execucoes, setExecucoes] = useState<BackupExecucaoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [gerandoManual, setGerandoManual] = useState(false)

  // Modal de Detalhes do Snapshot
  const [snapshotDetalhe, setSnapshotDetalhe] = useState<BackupExecucaoRecord | null>(null)

  // Estado de Exportação em Lote do GED
  const [exportandoGed, setExportandoGed] = useState(false)
  const [gedProgress, setGedProgress] = useState<{
    ativo: boolean
    processados: number
    total: number
    arquivoAtual: string
  }>({
    ativo: false,
    processados: 0,
    total: 0,
    arquivoAtual: '',
  })

  // Modal de Aviso de Ciência LGPD no Download
  const [downloadPendente, setDownloadPendente] = useState<BackupExecucaoRecord | null>(null)
  const [baixandoSnapshotId, setBaixandoSnapshotId] = useState<string | null>(null)

  // Política de Retenção
  const [retencaoConfig, setRetencaoConfig] = useState<number>(7)
  const [salvandoRetencao, setSalvandoRetencao] = useState(false)

  const isAdministrador = member?.perfil === 'administrador'

  const carregarHistorico = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const lista = await backupService.listarExecucoes(tenant.id)
      setExecucoes(lista)
      if (lista.length > 0 && lista[0].retencao_dias) {
        setRetencaoConfig(lista[0].retencao_dias)
      }
    } catch (err) {
      console.error('Erro ao carregar histórico de backups:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao listar backups',
        description: 'Não foi possível consultar os snapshots.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, toast])

  useEffect(() => {
    carregarHistorico()
  }, [carregarHistorico])

  // Último snapshot e próximo agendado
  const ultimoSnapshot = useMemo(() => {
    return execucoes.length > 0 ? execucoes[0] : null
  }, [execucoes])

  const proximoAgendadoInfo = useMemo(() => {
    // Cron roda diariamente às 03:30 UTC (00:30 BRT)
    const agora = new Date()
    const proximo = new Date()
    // Configura 03:30 UTC
    proximo.setUTCHours(3, 30, 0, 0)
    if (agora.getTime() >= proximo.getTime()) {
      proximo.setUTCDate(proximo.getUTCDate() + 1)
    }
    return formatDateTimePtBr(proximo.toISOString())
  }, [])

  // Disparar backup manual
  const handleGerarBackupAgora = async () => {
    if (!tenant?.id || !user?.id) return
    try {
      setGerandoManual(true)
      const res = await backupService.gerarBackupAgora(tenant.id, user.id)
      toast({
        title:
          res.status === 'sucesso' ? 'Backup gerado com sucesso!' : 'Backup gerado com ressalvas',
        description: `${res.total_registros} registros consolidados em snapshot independente.`,
      })
      await carregarHistorico()
    } catch (err) {
      console.error('Erro ao gerar backup manual:', err)
      toast({
        variant: 'destructive',
        title: 'Falha ao executar backup',
        description: err instanceof Error ? err.message : 'Erro no processamento do servidor.',
      })
    } finally {
      setGerandoManual(false)
    }
  }

  // Confirmar download e ciência LGPD
  const handleConfirmarDownload = async () => {
    if (!downloadPendente || !tenant?.id || !user?.id) return
    const bkp = downloadPendente
    try {
      setBaixandoSnapshotId(bkp.id)
      setDownloadPendente(null)
      await backupService.baixarSnapshot(
        bkp.id,
        tenant.id,
        user.id,
        `snapshot_contabil_${tenant.nome.replace(/\s+/g, '_')}_${bkp.data_execucao.split('T')[0]}.json`,
      )
      toast({
        title: 'Download iniciado',
        description:
          'Snapshot JSON exportado com sucesso. Lembre-se de armazená-lo em local criptografado.',
      })
    } catch (err) {
      console.error('Erro no download do snapshot:', err)
      toast({
        variant: 'destructive',
        title: 'Erro no download',
        description: err instanceof Error ? err.message : 'Não foi possível baixar o arquivo.',
      })
    } finally {
      setBaixandoSnapshotId(null)
    }
  }

  // Exportar acervo GED em lote (ZIP)
  const handleExportarGedLote = async () => {
    if (!tenant?.id || !user?.id) return
    try {
      setExportandoGed(true)
      setGedProgress({
        ativo: true,
        processados: 0,
        total: 0,
        arquivoAtual: 'Iniciando manifesto...',
      })

      const resultado = await backupService.baixarGedLote(
        tenant.id,
        user.id,
        (processados, total, arquivoAtual) => {
          setGedProgress({
            ativo: true,
            processados,
            total,
            arquivoAtual,
          })
        },
      )

      toast({
        title: 'Acervo GED baixado!',
        description: `${resultado.totalBaixados} arquivos empacotados em ZIP por empresa e categoria.`,
      })
    } catch (err) {
      console.error('Erro ao exportar acervo GED:', err)
      toast({
        variant: 'destructive',
        title: 'Falha na exportação do GED',
        description: err instanceof Error ? err.message : 'Erro ao processar acervo digital.',
      })
    } finally {
      setExportandoGed(false)
      setGedProgress({ ativo: false, processados: 0, total: 0, arquivoAtual: '' })
    }
  }

  // Salvar configuração de retenção
  const handleSalvarRetencao = async () => {
    if (!tenant?.id || !user?.id) return
    try {
      setSalvandoRetencao(true)
      await backupService.atualizarRetencaoConfig(tenant.id, user.id, retencaoConfig)
      toast({
        title: 'Política de retenção atualizada',
        description: `Os ${retencaoConfig} snapshots mais recentes serão mantidos automaticamente.`,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar retenção',
      })
    } finally {
      setSalvandoRetencao(false)
    }
  }

  const formatTamanho = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 KB'
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sucesso':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 font-semibold">
            <CheckCircle2 className="h-3 w-3" /> Sucesso Total
          </Badge>
        )
      case 'parcial':
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1 font-semibold">
            <AlertTriangle className="h-3 w-3" /> Parcial
          </Badge>
        )
      case 'falhou':
        return (
          <Badge className="bg-red-50 text-red-700 border-red-200 gap-1 font-semibold">
            <XCircle className="h-3 w-3" /> Falhou
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (!isAdministrador) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4 border border-amber-200">
          <Lock className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-[#1A2333]">Acesso Restrito ao Administrador</h2>
        <p className="mt-2 max-w-md text-xs text-[#64748B]">
          O Sistema de Backup Independente contém chaves, extratos e todos os dados fiscais e
          salariais da carteira. Somente o perfil de Administrador do escritório possui permissão de
          gestão e download.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner de Alerta e Conformidade LGPD */}
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/90 via-amber-50/50 to-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
            <Shield className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
              Ressalva de Segurança & Proteção de Dados (LGPD)
            </h3>
            <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
              Os backups e exportações contêm CPFs, dados bancários, folhas de pagamento, contratos
              e documentos fiscais confidenciais. Armazene os arquivos baixados exclusivamente em
              dispositivos ou nuvens com criptografia de ponta a ponta e controle restrito de
              acesso.
            </p>
          </div>
        </div>
      </div>

      {/* Header Principal */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">
              Sistema de Backup Independente
            </h2>
            <Badge className="bg-[#0FA3A3] text-white text-[10px] uppercase font-bold tracking-wider">
              0.0.94
            </Badge>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Garantia de soberania de dados para o escritório contábil: snapshots estruturados do
            banco e exportação em lote do GED
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={carregarHistorico}
            variant="outline"
            size="sm"
            disabled={loading}
            className="h-9 gap-1.5 rounded-xl border-[#E2E8F0] text-xs font-semibold"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>

          <Button
            onClick={handleExportarGedLote}
            variant="outline"
            size="sm"
            disabled={exportandoGed}
            className="h-9 gap-1.5 rounded-xl border-[#123B6D]/30 bg-slate-50 text-[#0B1F3A] hover:bg-slate-100 text-xs font-semibold shadow-xs"
          >
            {exportandoGed ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0FA3A3]" />
            ) : (
              <FolderArchive className="h-3.5 w-3.5 text-[#0FA3A3]" />
            )}
            <span>Exportar Acervo GED (ZIP)</span>
          </Button>

          <Button
            onClick={handleGerarBackupAgora}
            size="sm"
            disabled={gerandoManual}
            className="h-9 gap-1.5 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white text-xs font-semibold shadow-xs"
          >
            {gerandoManual ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            <span>Gerar Backup Agora</span>
          </Button>
        </div>
      </div>

      {/* Barra de Progresso de Exportação do GED (se ativo) */}
      {gedProgress.ativo && (
        <Card className="rounded-2xl border-[#0FA3A3]/40 bg-teal-50/40 p-4 shadow-xs">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#0B1F3A]">
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#0FA3A3]" />
                Exportando Acervo Digital GED ({gedProgress.processados} de {gedProgress.total})
              </span>
              <span>
                {gedProgress.total > 0
                  ? Math.round((gedProgress.processados / gedProgress.total) * 100)
                  : 0}
                %
              </span>
            </div>
            <Progress
              value={
                gedProgress.total > 0 ? (gedProgress.processados / gedProgress.total) * 100 : 10
              }
              className="h-2 bg-slate-200"
            />
            <p className="text-[11px] text-[#64748B] truncate">
              Processando: {gedProgress.arquivoAtual}
            </p>
          </div>
        </Card>
      )}

      {/* Cards de Status do Agendador & Retenção */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Último Snapshot */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center justify-between">
              <span>Último Snapshot</span>
              <Database className="h-4 w-4 text-[#0FA3A3]" />
            </CardDescription>
            <CardTitle className="text-base font-bold text-[#1A2333]">
              {ultimoSnapshot ? formatDateTimePtBr(ultimoSnapshot.data_execucao) : 'Nenhum ainda'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {ultimoSnapshot ? (
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Status:</span>
                  {getStatusBadge(ultimoSnapshot.status)}
                </div>
                <div className="flex items-center justify-between text-[#64748B]">
                  <span>Tamanho:</span>
                  <span className="font-semibold text-[#1A2333]">
                    {formatTamanho(ultimoSnapshot.tamanho_estimado_bytes)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#94A3B8]">Aguardando primeira execução</p>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Próximo Agendado */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center justify-between">
              <span>Próximo Agendado</span>
              <Clock className="h-4 w-4 text-[#3B82F6]" />
            </CardDescription>
            <CardTitle className="text-base font-bold text-[#1A2333]">03:30 UTC Diário</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs space-y-1">
            <p className="text-[#64748B]">
              Próxima janela:{' '}
              <span className="font-semibold text-[#1A2333]">{proximoAgendadoInfo}</span>
            </p>
            <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Job ativo no agendador Skip</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Política de Retenção */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center justify-between">
              <span>Retenção Ativa</span>
              <Archive className="h-4 w-4 text-[#8B5CF6]" />
            </CardDescription>
            <CardTitle className="text-base font-bold text-[#1A2333]">
              {retencaoConfig} Snapshots
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs space-y-2">
            <p className="text-[#64748B]">
              Mantém os snapshots mais recentes e purga com auditoria.
            </p>
            <div className="flex items-center gap-2">
              <select
                value={retencaoConfig}
                onChange={(e) => setRetencaoConfig(Number(e.target.value))}
                aria-label="Limite de retenção de snapshots"
                className="h-7 text-xs rounded-lg border border-[#E2E8F0] bg-slate-50 px-2 font-semibold text-[#1A2333]"
              >
                <option value={5}>5 snapshots</option>
                <option value={7}>7 snapshots (padrão)</option>
                <option value={15}>15 snapshots</option>
                <option value={30}>30 snapshots</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSalvarRetencao}
                disabled={salvandoRetencao}
                className="h-7 px-2 text-[11px] text-[#0FA3A3] hover:text-[#0C8585] font-semibold"
              >
                {salvandoRetencao ? 'Salvando...' : 'Aplicar'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Cobertura do Acervo */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center justify-between">
              <span>Escopo & Formato</span>
              <HardDrive className="h-4 w-4 text-[#0FA3A3]" />
            </CardDescription>
            <CardTitle className="text-base font-bold text-[#1A2333]">JSON + Acervo GED</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs space-y-1">
            <p className="text-[#64748B]">
              Exportação estruturada de 30 coleções contábeis e fiscais.
            </p>
            <p className="text-emerald-700 font-semibold">Tolerância a erro ativa por tabela</p>
          </CardContent>
        </Card>
      </div>

      {/* Painel do Checklist de Backup Independente (Camadas de Soberania) */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
        <CardHeader className="border-b border-[#E2E8F0] bg-slate-50/75 py-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-[#1A2333]">
                Checklist de Soberania & Backup Independente
              </CardTitle>
              <CardDescription className="text-xs text-[#64748B] mt-0.5">
                Estado transparente de cada camada necessária para a independência tecnológica do
                escritório
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs border-[#E2E8F0] bg-white font-medium">
              Conformidade Contábil
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Camada 1: Banco de Dados */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  1. Banco de Dados
                </span>
                <Badge className="bg-emerald-600 text-white text-[10px]">Entregue</Badge>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Snapshot diário automatizado às 03:30 UTC e disparo manual sob demanda. Exporta
                todas as empresas, lançamentos, folha, tributos e auditoria em JSON estruturado
                independente.
              </p>
            </div>

            {/* Camada 2: Documentos (GED) */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  2. Documentos / GED
                </span>
                <Badge className="bg-emerald-600 text-white text-[10px]">Entregue</Badge>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Exportação em lote via pacote ZIP estruturado por empresa (CNPJ_RazãoSocial) e
                categoria de documento, com manifesto JSON de integridade e registro auditado.
              </p>
            </div>

            {/* Camada 3: Código-Fonte & Versionamento */}
            <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  3. Código-Fonte & Versão
                </span>
                <Badge className="bg-amber-600 text-white text-[10px]">Pendente Conexão</Badge>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                Exige conectar o repositório GitHub nas configurações do projeto na Skip Cloud. A
                plataforma mantém o versionamento interno (v0.0.94), mas o espelhamento externo
                independente requer a integração do GitHub pelo painel administrativo.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Histórico de Snapshots Disponíveis */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
        <CardHeader className="border-b border-[#E2E8F0] bg-slate-50/75 py-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-[#1A2333]">
                Snapshots Disponíveis para Download
              </CardTitle>
              <CardDescription className="text-xs text-[#64748B] mt-0.5">
                Histórico de execuções com detalhamento de coleções exportadas, contagens e
                auditoria
              </CardDescription>
            </div>
            <span className="text-xs text-[#64748B] font-medium">
              Total de snapshots: {execucoes.length}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tamanho</th>
                  <th className="py-3 px-4">Coleções / Registros</th>
                  <th className="py-3 px-4">Responsável</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#64748B]">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-[#0FA3A3]" />
                        <span>Carregando histórico de snapshots...</span>
                      </div>
                    </td>
                  </tr>
                ) : execucoes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#94A3B8]">
                      Nenhum snapshot de backup registrado ainda. Clique em &quot;Gerar Backup
                      Agora&quot; para criar o primeiro.
                    </td>
                  </tr>
                ) : (
                  execucoes.map((item) => {
                    const contagemTotal = item.contagem_registros
                      ? Object.values(item.contagem_registros).reduce((a, b) => a + b, 0)
                      : 0

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-[#1A2333] whitespace-nowrap font-medium">
                          {formatDateTimePtBr(item.data_execucao)}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant="outline"
                            className={
                              item.tipo === 'agendado'
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }
                          >
                            {item.tipo === 'agendado' ? 'Agendado (03:30)' : 'Manual (Sob Demanda)'}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4">{getStatusBadge(item.status)}</td>
                        <td className="py-3.5 px-4 text-[#64748B] font-mono">
                          {formatTamanho(item.tamanho_estimado_bytes)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#1A2333]">
                              {contagemTotal} registros
                            </span>
                            <span className="text-[11px] text-[#94A3B8]">
                              ({item.colecoes_exportadas?.length || 0} tabelas)
                            </span>
                          </div>
                          {item.colecoes_com_erro && item.colecoes_com_erro.length > 0 && (
                            <span className="text-[10px] text-red-600 block mt-0.5">
                              {item.colecoes_com_erro.length} coleção(ões) com falha
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[#64748B]">
                          {item.tipo === 'agendado' ? (
                            <span className="text-[11px] text-[#94A3B8] italic">
                              Agendador Automático
                            </span>
                          ) : (
                            item.expand?.executado_por?.name ||
                            item.expand?.executado_por?.email ||
                            'Administrador'
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSnapshotDetalhe(item)}
                              className="h-8 px-2 text-xs text-[#64748B] hover:text-[#1A2333]"
                            >
                              <Info className="h-3.5 w-3.5 mr-1" />
                              Detalhes
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              disabled={baixandoSnapshotId === item.id}
                              onClick={() => setDownloadPendente(item)}
                              className="h-8 gap-1 rounded-lg border-[#0FA3A3]/40 text-[#0FA3A3] hover:bg-teal-50 text-xs font-semibold"
                            >
                              {baixandoSnapshotId === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              <span>Baixar</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* DIÁLOGO: DETALHES DO SNAPSHOT */}
      <Dialog open={!!snapshotDetalhe} onOpenChange={(open) => !open && setSnapshotDetalhe(null)}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
              <Database className="h-5 w-5 text-[#0FA3A3]" />
              Detalhamento do Snapshot #{snapshotDetalhe?.id}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registro auditado de integridade e contagem individual de cada coleção exportada
            </DialogDescription>
          </DialogHeader>

          {snapshotDetalhe && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 border border-[#E2E8F0]">
                <div>
                  <span className="text-[#64748B] block text-[11px]">Data / Hora:</span>
                  <span className="font-semibold text-[#1A2333]">
                    {formatDateTimePtBr(snapshotDetalhe.data_execucao)}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[11px]">Tipo de Execução:</span>
                  <span className="font-semibold text-[#1A2333] capitalize">
                    {snapshotDetalhe.tipo}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[11px]">Status Consolidado:</span>
                  <div className="mt-0.5">{getStatusBadge(snapshotDetalhe.status)}</div>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[11px]">Tamanho do Arquivo:</span>
                  <span className="font-semibold text-[#1A2333]">
                    {formatTamanho(snapshotDetalhe.tamanho_estimado_bytes)}
                  </span>
                </div>
              </div>

              {snapshotDetalhe.mensagem && (
                <div className="p-3 rounded-xl bg-slate-100 text-[#1A2333] text-xs">
                  <p className="font-semibold mb-0.5 text-[11px] text-[#64748B] uppercase">
                    Resumo do Log
                  </p>
                  <p>{snapshotDetalhe.mensagem}</p>
                </div>
              )}

              {/* Contagem por Tabela */}
              <div>
                <p className="text-xs font-bold text-[#1A2333] mb-2">
                  Contagem de Registros por Coleção:
                </p>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-[#E2E8F0] p-2 space-y-1 bg-white">
                  {snapshotDetalhe.contagem_registros &&
                  Object.keys(snapshotDetalhe.contagem_registros).length > 0 ? (
                    Object.entries(snapshotDetalhe.contagem_registros).map(([col, qtd]) => (
                      <div
                        key={col}
                        className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-slate-50 text-xs"
                      >
                        <span className="font-mono text-[#64748B]">{col}</span>
                        <span className="font-bold text-[#1A2333]">{qtd} registros</span>
                      </div>
                    ))
                  ) : (
                    <p className="py-4 text-center text-xs text-[#94A3B8]">
                      Nenhuma contagem detalhada gravada.
                    </p>
                  )}
                </div>
              </div>

              {/* Erros se houver */}
              {snapshotDetalhe.colecoes_com_erro &&
                snapshotDetalhe.colecoes_com_erro.length > 0 && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-red-800">
                      <AlertTriangle className="h-4 w-4" /> Falhas registradas em coleções:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                      {snapshotDetalhe.colecoes_com_erro.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSnapshotDetalhe(null)}
              className="rounded-xl text-xs"
            >
              Fechar
            </Button>
            {snapshotDetalhe && (
              <Button
                size="sm"
                onClick={() => {
                  const item = snapshotDetalhe
                  setSnapshotDetalhe(null)
                  setDownloadPendente(item)
                }}
                className="rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585] text-xs font-semibold gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Baixar este Snapshot</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: CONFIRMAÇÃO DE DOWNLOAD & CIÊNCIA LGPD */}
      <Dialog open={!!downloadPendente} onOpenChange={(open) => !open && setDownloadPendente(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              Confirmação de Download Seguro (LGPD)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Leia as diretrizes de segurança antes de transferir o arquivo para seu dispositivo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 leading-relaxed">
              <p className="font-semibold mb-1">Aviso Legal Obrigatório:</p>
              Este arquivo contém dados contábeis, folhas de pagamento com salários e CPFs,
              lançamentos fiscais e cadastros societários. A responsabilidade pela guarda,
              criptografia e não-vazamento do arquivo local é do responsável legal do escritório.
            </div>

            <p className="text-[#64748B]">
              O download será registrado com data, hora, IP e usuário responsável na Trilha Oficial
              de Auditoria da plataforma.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDownloadPendente(null)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarDownload}
              className="rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585] text-xs font-semibold gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Estou ciente e desejo baixar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

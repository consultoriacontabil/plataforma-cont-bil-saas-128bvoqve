import React, { useState, useEffect, useCallback } from 'react'
import {
  Archive,
  RotateCcw,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Loader2,
  Calendar,
  Building2,
  Download,
} from 'lucide-react'
import { maskCnpj, formatDateTimePtBr } from '@/lib/formatters'
import type { ExclusaoEmpresaBackupRecord } from '@/types'
import { exclusoesService } from '@/services/exclusoes'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

interface PainelExclusoesBackupsProps {
  tenantId: string
  usuarioId: string
  canManage: boolean
  onAtualizacao?: () => void
}

export function PainelExclusoesBackups({
  tenantId,
  usuarioId,
  canManage,
  onAtualizacao,
}: PainelExclusoesBackupsProps) {
  const { toast } = useToast()
  const [backups, setBackups] = useState<ExclusaoEmpresaBackupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'retido' | 'restaurado' | 'purgado'>(
    'todos',
  )

  // Modais de Ação
  const [backupParaRestaurar, setBackupParaRestaurar] =
    useState<ExclusaoEmpresaBackupRecord | null>(null)
  const [restaurando, setRestaurando] = useState(false)

  const [backupParaPurgar, setBackupParaPurgar] = useState<ExclusaoEmpresaBackupRecord | null>(null)
  const [purgando, setPurgando] = useState(false)

  const [backupVisualizar, setBackupVisualizar] = useState<ExclusaoEmpresaBackupRecord | null>(null)

  const carregarBackups = useCallback(async () => {
    try {
      setLoading(true)
      const list = await exclusoesService.list(tenantId)
      setBackups(list)
    } catch (err) {
      console.error('Erro ao carregar lista de backups:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar backups',
        description: 'Não foi possível listar os backups de exclusão.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenantId, toast])

  useEffect(() => {
    carregarBackups()
  }, [carregarBackups])

  // Contagem regressiva calculada a partir de purga_em
  const calcularTempoRestante = (purgaEmStr?: string) => {
    if (!purgaEmStr) return 'Prazo indisponível'
    const purgaEm = new Date(purgaEmStr).getTime()
    const now = Date.now()
    const diff = purgaEm - now

    if (diff <= 0) return 'Expirado (aguardando purga automática)'

    const horas = Math.floor(diff / (1000 * 60 * 60))
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `Expira em ${horas}h ${minutos}min`
  }

  const handleRestaurar = async () => {
    if (!backupParaRestaurar) return
    setRestaurando(true)
    try {
      await exclusoesService.restaurarBackup(backupParaRestaurar.id, usuarioId)
      toast({
        title: 'Empresa restaurada com sucesso!',
        description: `A empresa ${backupParaRestaurar.razao_social} foi restaurada e voltou a ficar ativa nas consultas do escritório.`,
      })
      setBackupParaRestaurar(null)
      carregarBackups()
      if (onAtualizacao) onAtualizacao()
    } catch (err: any) {
      console.error('Erro ao restaurar:', err)
      toast({
        variant: 'destructive',
        title: 'Falha ao restaurar',
        description: err?.message || 'Não foi possível restaurar os dados do backup.',
      })
    } finally {
      setRestaurando(false)
    }
  }

  const handlePurgarAgora = async () => {
    if (!backupParaPurgar) return
    setPurgando(true)
    try {
      await exclusoesService.purgarDefinitivamente(backupParaPurgar.id, usuarioId)
      toast({
        title: 'Purga definitiva concluída',
        description: `Os registros da empresa ${backupParaPurgar.razao_social} foram purgados permanentemente.`,
      })
      setBackupParaPurgar(null)
      carregarBackups()
      if (onAtualizacao) onAtualizacao()
    } catch (err: any) {
      console.error('Erro ao purgar:', err)
      toast({
        variant: 'destructive',
        title: 'Falha ao purgar',
        description: err?.message || 'Não foi possível purgar a empresa.',
      })
    } finally {
      setPurgando(false)
    }
  }

  const downloadJsonBackup = (b: ExclusaoEmpresaBackupRecord) => {
    try {
      const dataStr =
        'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(b.dados_json, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute('href', dataStr)
      downloadAnchor.setAttribute('download', `backup-exclusao-${b.cnpj}-${b.empresa_id}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
    } catch (err) {
      console.error('Erro ao baixar JSON:', err)
    }
  }

  const backupsFiltrados = backups.filter((b) => {
    const matchSearch =
      search.trim() === '' ||
      b.razao_social.toLowerCase().includes(search.toLowerCase()) ||
      b.cnpj.includes(search)
    const matchStatus = filtroStatus === 'todos' || b.status === filtroStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6">
      {/* Top Banner Explicativo */}
      <Card className="rounded-2xl border-amber-200 bg-amber-50/50 shadow-xs">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-800">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1A2333]">
                Salvaguarda e Histórico de Exclusões (Retenção 24h)
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5 max-w-2xl">
                Toda exclusão solicitada no escritório gera um backup consolidado em JSON. Os dados
                ficam retidos por 24 horas, permitindo reversão imediata caso haja arrependimento ou
                engano. Após 24h, o cron automatizado purga os registros de forma definitiva e
                irrecuperável.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={carregarBackups}
              className="text-xs h-9 rounded-xl border-amber-300 hover:bg-amber-100"
            >
              Atualizar Lista
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por razão social ou CNPJ..."
            className="pl-9 text-xs h-9 rounded-xl border-slate-200"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(['todos', 'retido', 'restaurado', 'purgado'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFiltroStatus(st)}
              className={`text-xs px-3 py-1 rounded-full font-semibold transition-all ${
                filtroStatus === st
                  ? 'bg-[#0B1F3A] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'todos'
                ? 'Todos'
                : st === 'retido'
                  ? 'Retidos (Em 24h)'
                  : st === 'restaurado'
                    ? 'Restaurados'
                    : 'Purgados'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de Backups de Exclusão */}
      <Card className="rounded-2xl border-slate-200 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3.5 px-4">Empresa</th>
                  <th className="py-3.5 px-4">CNPJ</th>
                  <th className="py-3.5 px-4">Backup JSON</th>
                  <th className="py-3.5 px-4">Solicitado Em</th>
                  <th className="py-3.5 px-4">Status & Prazo</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-[#0FA3A3]" />
                        <span>Carregando backups de exclusão...</span>
                      </div>
                    </td>
                  </tr>
                ) : backupsFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Nenhum registro de exclusão encontrado.
                    </td>
                  </tr>
                ) : (
                  backupsFiltrados.map((b) => {
                    const isRetido = b.status === 'retido'
                    const tempoRestante = isRetido ? calcularTempoRestante(b.purga_em) : null
                    const kb = b.tamanho_bytes ? (b.tamanho_bytes / 1024).toFixed(1) : '0'

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{b.razao_social}</div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            ID: {b.empresa_id}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">{maskCnpj(b.cnpj)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal border-teal-200 bg-teal-50 text-teal-800"
                            >
                              {b.total_registros || 1} registros
                            </Badge>
                            <span className="text-[10px] text-slate-400">({kb} KB)</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{formatDateTimePtBr(b.criado_em || b.created)}</div>
                          {b.expand?.criado_por && (
                            <span className="text-[10px] text-slate-400">
                              por {b.expand.criado_por.name}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isRetido ? (
                            <div className="space-y-1">
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold gap-1">
                                <Clock className="h-3 w-3" />
                                <span>Retido (24h)</span>
                              </Badge>
                              <div className="text-[11px] font-semibold text-amber-700">
                                {tempoRestante}
                              </div>
                            </div>
                          ) : b.status === 'restaurado' ? (
                            <div className="space-y-0.5">
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Restaurado</span>
                              </Badge>
                              {b.restaurado_em && (
                                <p className="text-[10px] text-slate-400">
                                  {formatDateTimePtBr(b.restaurado_em)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] font-semibold gap-1">
                                <Trash2 className="h-3 w-3" />
                                <span>Purgado Definitivo</span>
                              </Badge>
                              {b.purgado_em && (
                                <p className="text-[10px] text-slate-400">
                                  {formatDateTimePtBr(b.purgado_em)}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Botão Baixar JSON */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadJsonBackup(b)}
                              title="Baixar Backup JSON consolidado"
                              className="h-8 text-xs text-slate-600 hover:text-slate-900"
                            >
                              <Download className="h-3.5 w-3.5 mr-1" />
                              JSON
                            </Button>

                            {/* Ações para Retido */}
                            {isRetido && canManage && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setBackupParaRestaurar(b)}
                                  className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1 font-semibold"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  <span>Restaurar</span>
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setBackupParaPurgar(b)}
                                  className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50 gap-1"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Purgar Agora</span>
                                </Button>
                              </>
                            )}
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

      {/* Modal Confirmar Restauração */}
      <Dialog open={Boolean(backupParaRestaurar)} onOpenChange={() => setBackupParaRestaurar(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-[#1A2333] flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-emerald-600" />
              <span>Restaurar Empresa de Backup</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Deseja restaurar a empresa{' '}
              <strong className="text-slate-900">{backupParaRestaurar?.razao_social}</strong> (CNPJ:{' '}
              {backupParaRestaurar && maskCnpj(backupParaRestaurar.cnpj)})?
              <br />
              <br />A empresa voltará para o status <strong>Ativo</strong> e seus registros
              vinculados estarão novamente acessíveis nas rotinas contábeis, fiscais e financeiras.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={restaurando}
              onClick={() => setBackupParaRestaurar(null)}
              className="text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              disabled={restaurando}
              onClick={handleRestaurar}
              className="text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
            >
              {restaurando ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Restaurando...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Confirmar Restauração</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Purga Imediata */}
      <Dialog open={Boolean(backupParaPurgar)} onOpenChange={() => setBackupParaPurgar(null)}>
        <DialogContent className="rounded-2xl max-w-md border-red-200">
          <DialogHeader>
            <DialogTitle className="text-base text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span>Purga Definitiva Imediata</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Atenção: Ao antecipar a purga definitiva da empresa{' '}
              <strong className="text-slate-900">{backupParaPurgar?.razao_social}</strong> (CNPJ:{' '}
              {backupParaPurgar && maskCnpj(backupParaPurgar.cnpj)}), TODOS os registros no banco de
              dados e cadastro serão excluídos permanentemente sem aguardar o fim das 24 horas.
              <br />
              <br />
              <strong className="text-red-700">Esta operação é irreversível.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={purgando}
              onClick={() => setBackupParaPurgar(null)}
              className="text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={purgando}
              onClick={handlePurgarAgora}
              className="text-xs rounded-xl bg-red-600 hover:bg-red-700 font-semibold gap-1.5"
            >
              {purgando ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Purgando...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Purgar Definitivamente Agora</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

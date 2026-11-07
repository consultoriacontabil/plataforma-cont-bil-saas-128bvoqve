import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'

/**
 * Aprovação de ações propostas pelo Operador Rumo.
 *
 * O agente não altera dado de negócio: ele enfileira a intenção em
 * `operador_acoes` com valor atual, valor novo e motivo. Esta tela é onde um
 * Administrador ou Contador decide. Só na aprovação a alteração é aplicada —
 * e só se o campo estiver na lista fechada do servidor.
 *
 * Regra de segregação: quem propôs não aprova (o servidor recusa).
 */

interface AcaoPendente {
  id: string
  colecao: string
  registro_id: string
  campo: string
  valor_atual: string
  valor_proposto: string
  motivo: string
  criado: string
}

const NOMES_COLECAO: Record<string, string> = {
  obrigacoes: 'Obrigação',
  workflows: 'Workflow',
  processo_pendencias: 'Pendência',
  elisa_jobs: 'Job',
  notificacoes: 'Notificação',
}

const NOMES_CAMPO: Record<string, string> = {
  status: 'Status',
  observacoes: 'Observações',
  data_entrega: 'Data de entrega',
  responsavel_id: 'Responsável',
  valor: 'Valor',
  etapa_atual: 'Etapa atual',
  descricao: 'Descrição',
  prioridade: 'Prioridade',
  resultado: 'Resultado',
  lida: 'Lida',
}

export default function AprovacoesPage() {
  const { tenant } = useAuth()
  const { toast } = useToast()

  const [acoes, setAcoes] = useState<AcaoPendente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState<string>('')

  const [selecionada, setSelecionada] = useState<AcaoPendente | null>(null)
  const [decisao, setDecisao] = useState<'aprovada' | 'rejeitada'>('aprovada')
  const [justificativa, setJustificativa] = useState('')
  const [processando, setProcessando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setErro('')
      const res = await pb.send('/backend/v1/operador/acoes/pendentes', { method: 'GET' })
      setAcoes((res?.acoes || []) as AcaoPendente[])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErro(msg)
      setAcoes([])
    } finally {
      setCarregando(false)
      setAtualizando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const abrirDecisao = (acao: AcaoPendente, tipo: 'aprovada' | 'rejeitada') => {
    setSelecionada(acao)
    setDecisao(tipo)
    setJustificativa('')
  }

  const confirmar = async () => {
    if (!selecionada) return

    if (decisao === 'rejeitada' && !justificativa.trim()) {
      toast({
        title: 'Justificativa obrigatória',
        description: 'Ao rejeitar, explique o motivo — fica registrado na auditoria.',
        variant: 'destructive',
      })
      return
    }

    setProcessando(true)
    try {
      const res = await pb.send('/backend/v1/operador/acoes/decidir', {
        method: 'POST',
        body: {
          acao_id: selecionada.id,
          decisao: decisao,
          justificativa: justificativa.trim(),
        },
      })

      if (res?.status === 'executada') {
        toast({
          title: 'Ação aplicada',
          description: `${NOMES_CAMPO[selecionada.campo] || selecionada.campo}: "${res.antes}" → "${res.depois}"`,
        })
      } else {
        toast({ title: 'Ação rejeitada', description: 'Nada foi alterado no sistema.' })
      }

      setSelecionada(null)
      setAtualizando(true)
      await carregar()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast({
        title: 'Não foi possível concluir',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setProcessando(false)
    }
  }

  const formatarData = (iso: string) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0B1F3A] flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#0FA3A3]" />
            Aprovações do Operador
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Alterações propostas pelo agente. Nada é aplicado sem a sua decisão.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setAtualizando(true)
            void carregar()
          }}
          disabled={atualizando}
          className="h-9 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${atualizando ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                  Aguardando você
                </p>
                <p className="text-2xl font-bold text-[#0B1F3A] mt-1">{acoes.length}</p>
              </div>
              <Clock className="h-7 w-7 text-amber-500 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                  Escritório
                </p>
                <p className="text-sm font-semibold text-[#0B1F3A] mt-1 truncate">
                  {tenant?.nome || '—'}
                </p>
              </div>
              <ShieldCheck className="h-7 w-7 text-teal-500 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                  Quem pode aprovar
                </p>
                <p className="text-sm font-semibold text-[#0B1F3A] mt-1">
                  Administrador · Contador
                </p>
              </div>
              <CheckCircle2 className="h-7 w-7 text-emerald-500 opacity-70" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Erro */}
      {erro && (
        <Card className="rounded-2xl border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-900">
              <p className="font-semibold">Não consegui carregar a fila</p>
              <p className="mt-1 text-amber-800">{erro}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      {carregando ? (
        <Card className="rounded-2xl border-slate-200">
          <CardContent className="p-10 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
            <p className="text-xs text-slate-500">Carregando propostas…</p>
          </CardContent>
        </Card>
      ) : acoes.length === 0 ? (
        <Card className="rounded-2xl border-slate-200">
          <CardContent className="p-12 flex flex-col items-center gap-3 text-center">
            <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0B1F3A]">Nada aguardando aprovação</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Quando o Operador Rumo precisar alterar status, observação, responsável ou data, a
                proposta aparece aqui antes de qualquer mudança.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {acoes.map((a) => (
            <Card key={a.id} className="rounded-2xl border-slate-200 shadow-xs">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] border-teal-300 bg-teal-50 text-teal-800"
                      >
                        {NOMES_COLECAO[a.colecao] || a.colecao}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {NOMES_CAMPO[a.campo] || a.campo}
                      </Badge>
                      <span className="text-[10px] text-slate-400">
                        proposto em {formatarData(a.criado)}
                      </span>
                    </div>

                    {/* De → Para */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-slate-500">De</span>
                      <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] break-all">
                        {a.valor_atual || '(vazio)'}
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="text-slate-500">Para</span>
                      <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 font-mono text-[11px] font-semibold break-all">
                        {a.valor_proposto || '(vazio)'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-2">
                      <span className="font-semibold text-slate-700">Motivo: </span>
                      {a.motivo}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">
                      registro {a.registro_id}
                    </p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => abrirDecisao(a, 'aprovada')}
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirDecisao(a, 'rejeitada')}
                      className="h-8 text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de decisão */}
      <Dialog open={!!selecionada} onOpenChange={(o) => !o && setSelecionada(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              {decisao === 'aprovada' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Confirmar aprovação
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-rose-600" /> Rejeitar proposta
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {decisao === 'aprovada'
                ? 'A alteração será aplicada agora e registrada na auditoria.'
                : 'Nada será alterado. A decisão fica registrada na auditoria.'}
            </DialogDescription>
          </DialogHeader>

          {selecionada && (
            <div className="space-y-3 py-1">
              <div className="rounded-xl bg-slate-50 p-3 space-y-1.5 text-xs">
                <p className="text-slate-500">
                  {NOMES_COLECAO[selecionada.colecao] || selecionada.colecao} ·{' '}
                  {NOMES_CAMPO[selecionada.campo] || selecionada.campo}
                </p>
                <p className="font-mono text-[11px] break-all">
                  <span className="text-slate-500">{selecionada.valor_atual || '(vazio)'}</span>
                  <span className="mx-2 text-slate-400">→</span>
                  <span className="text-emerald-700 font-semibold">
                    {selecionada.valor_proposto || '(vazio)'}
                  </span>
                </p>
                <p className="text-slate-600 pt-1 border-t border-slate-200">
                  {selecionada.motivo}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">
                  {decisao === 'rejeitada'
                    ? 'Motivo da rejeição (obrigatório)'
                    : 'Observação (opcional)'}
                </label>
                <Textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder={
                    decisao === 'rejeitada'
                      ? 'Ex.: valor incorreto, preciso conferir a guia antes'
                      : 'Ex.: conferido com o cliente'
                  }
                  className="mt-1.5 text-xs min-h-[70px] rounded-xl"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelecionada(null)}
              disabled={processando}
              className="h-9 text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={confirmar}
              disabled={processando}
              className={`h-9 text-xs ${
                decisao === 'aprovada'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {processando ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Processando…
                </>
              ) : decisao === 'aprovada' ? (
                'Aprovar e aplicar'
              ) : (
                'Rejeitar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Send, Plus, Trash2, Users, ListChecks } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { rumoWhatsService, type WaWhatsTransmissaoRecord } from '@/services/rumoWhats'
import { useToast } from '@/hooks/use-toast'

/**
 * Tela 04 — Transmissão: criar lista de destinatários e gerar disparo em massa
 * como TAREFA na fila (wa_whats_disparos) para o agente externo Elliza executar
 * via ZAP da ELLIZA desktop. A plataforma NUNCA envia direto.
 */
export function RumoWhatsTransmissaoTab() {
  const { tenant } = useAuth()
  const { toast } = useToast()
  const [listas, setListas] = useState<WaWhatsTransmissaoRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [gerando, setGerando] = useState<string | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const [novaMensagem, setNovaMensagem] = useState('')
  const [novoDest, setNovoDest] = useState({ nome: '', telefone: '' })
  const [destinatarios, setDestinatarios] = useState<{ nome: string; telefone: string }[]>([])

  const carregar = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const l = await rumoWhatsService.listarTransmissoes(tenant.id)
      setListas(l)
    } catch (err) {
      console.error('Erro ao carregar transmissões:', err)
      toast({ title: 'Erro ao carregar listas de transmissão', variant: 'destructive' })
    } finally {
      setCarregando(false)
    }
  }, [tenant?.id, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  const handleAdicionarDest = () => {
    if (!novoDest.nome.trim() || !novoDest.telefone.trim()) return
    setDestinatarios((prev) => [
      ...prev,
      { nome: novoDest.nome.trim(), telefone: novoDest.telefone.trim() },
    ])
    setNovoDest({ nome: '', telefone: '' })
  }

  const handleCriarLista = async () => {
    if (!tenant?.id || !novoNome.trim() || destinatarios.length === 0) return
    try {
      const criada = await rumoWhatsService.criarTransmissao(tenant.id, {
        nome: novoNome.trim(),
        mensagem: novaMensagem,
        destinatarios,
      })
      setListas((prev) => [criada, ...prev])
      setNovoNome('')
      setNovaMensagem('')
      setDestinatarios([])
      toast({
        title: 'Lista criada',
        description: `${criada.total_destinatarios} destinatário(s).`,
      })
    } catch (err) {
      console.error('Erro ao criar lista:', err)
      toast({ title: 'Erro ao criar lista de transmissão', variant: 'destructive' })
    }
  }

  const handleDespachar = async (t: WaWhatsTransmissaoRecord) => {
    if (!tenant?.id) return
    setGerando(t.id)
    try {
      const qtd = await rumoWhatsService.despacharTransmissao(tenant.id, t)
      toast({
        title: 'Disparo enfileirado',
        description: `${qtd} tarefa(s) pendente(s) na fila — o agente Elliza executa via ZAP.`,
      })
      await carregar()
    } catch (err) {
      console.error('Erro ao despachar transmissão:', err)
      toast({ title: 'Erro ao gerar disparo em massa', variant: 'destructive' })
    } finally {
      setGerando(null)
    }
  }

  const badgeStatus = (s: string) => {
    if (s === 'concluida') return <Badge className="bg-[#E7F5F1] text-[#0B7A5E]">concluída</Badge>
    if (s === 'em_execucao')
      return <Badge className="bg-[#FFF4E0] text-[#B26A00]">em execução</Badge>
    if (s === 'despachada') return <Badge className="bg-[#E3F0FF] text-[#1D4ED8]">despachada</Badge>
    if (s === 'falha') return <Badge className="bg-[#FBE9E9] text-[#B3261E]">falha</Badge>
    return <Badge variant="secondary">rascunho</Badge>
  }

  if (carregando) {
    return <div className="py-10 text-center text-sm text-[#64748B]">Carregando transmissões…</div>
  }

  return (
    <div className="space-y-6">
      {/* Nova lista */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#0FA3A3]" />
            <div>
              <CardTitle className="text-base">Nova lista de transmissão</CardTitle>
              <CardDescription>
                Cadastre destinatários (nome + telefone com DDD) e a mensagem; ao gerar o disparo,
                cada destinatário vira uma tarefa pendente na fila para o agente externo.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="rumo-trans-nome">Nome da lista</Label>
              <Input
                id="rumo-trans-nome"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Aviso de guias — Novembro"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rumo-trans-msg">Mensagem</Label>
              <Input
                id="rumo-trans-msg"
                value={novaMensagem}
                onChange={(e) => setNovaMensagem(e.target.value)}
                placeholder="Prezados, as guias de novembro já estão disponíveis…"
              />
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <Label>Destinatários</Label>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1">
                <Label htmlFor="rumo-trans-dest-nome" className="sr-only">
                  Nome do destinatário
                </Label>
                <Input
                  id="rumo-trans-dest-nome"
                  value={novoDest.nome}
                  onChange={(e) => setNovoDest((d) => ({ ...d, nome: e.target.value }))}
                  placeholder="Nome"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rumo-trans-dest-tel" className="sr-only">
                  Telefone
                </Label>
                <Input
                  id="rumo-trans-dest-tel"
                  value={novoDest.telefone}
                  onChange={(e) => setNovoDest((d) => ({ ...d, telefone: e.target.value }))}
                  placeholder="5511999999999"
                  inputMode="tel"
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={handleAdicionarDest}
                  disabled={!novoDest.nome.trim() || !novoDest.telefone.trim()}
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Adicionar
                </Button>
              </div>
            </div>

            {destinatarios.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {destinatarios.map((d, i) => (
                  <Badge key={`${d.telefone}-${i}`} variant="outline" className="gap-1">
                    {d.nome} · {d.telefone}
                    <button
                      type="button"
                      onClick={() => setDestinatarios((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`Remover destinatário ${d.nome}`}
                      className="ml-1 text-[#B3261E]"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleCriarLista}
            disabled={!novoNome.trim() || destinatarios.length === 0}
          >
            Criar lista
          </Button>
        </CardContent>
      </Card>

      {/* Listas existentes */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-[#0FA3A3]" />
            <div>
              <CardTitle className="text-base">Listas de transmissão</CardTitle>
              <CardDescription>
                Status de cada lista e de seus disparos na fila do agente externo.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {listas.length === 0 ? (
            <p className="text-sm text-[#64748B] py-4 text-center">
              Nenhuma lista de transmissão criada ainda.
            </p>
          ) : (
            listas.map((t) => (
              <div key={t.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold">{t.nome}</p>
                    <p className="text-xs text-[#64748B]">
                      {t.destinatarios?.length ?? t.total_destinatarios ?? 0} destinatário(s)
                      {t.despachada_em
                        ? ` · despachada em ${new Date(t.despachada_em).toLocaleDateString('pt-BR')}`
                        : ''}
                      {t.concluida_em
                        ? ` · concluída em ${new Date(t.concluida_em).toLocaleDateString('pt-BR')}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {badgeStatus(t.status)}
                    <Button
                      size="sm"
                      onClick={() => handleDespachar(t)}
                      disabled={gerando === t.id || t.status === 'concluida'}
                    >
                      <Send className="h-4 w-4 mr-1.5" />
                      {gerando === t.id ? 'Enfileirando…' : 'Gerar disparo'}
                    </Button>
                  </div>
                </div>
                {t.mensagem && <p className="text-xs text-[#64748B] line-clamp-2">{t.mensagem}</p>}
              </div>
            ))
          )}

          <p className="text-xs text-[#64748B]">
            Gerar disparo cria as tarefas em <code>wa_whats_disparos</code> com status{' '}
            <code>pendente</code> — o agente externo Elliza as consome via{' '}
            <code>GET /backend/v1/rumo-whats/fila-disparos</code> e confirma cada envio. A
            plataforma nunca envia WhatsApp direto.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

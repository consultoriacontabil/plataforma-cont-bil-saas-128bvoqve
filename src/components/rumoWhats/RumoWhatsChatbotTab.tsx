import { useCallback, useEffect, useState } from 'react'
import { Bot, Plus, Pencil, Trash2, Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/AuthContext'
import {
  rumoWhatsService,
  type WaChatbotConfigRecord,
  type WaChatbotSetorRecord,
} from '@/services/rumoWhats'
import { useToast } from '@/hooks/use-toast'

/**
 * Tela 03 — Chatbot: saudação, menu de setores com palavras-chave e regra de
 * roteamento. A triagem (webhook rumo_whats.js) consome exatamente estes dados:
 * saudação + menu enviados na entrada, palavras-chave/entrada digitada → setor,
 * resposta inválida → mensagem_invalida / setor padrão.
 */
export function RumoWhatsChatbotTab() {
  const { tenant } = useAuth()
  const { toast } = useToast()
  const [config, setConfig] = useState<WaChatbotConfigRecord | null>(null)
  const [setores, setSetores] = useState<WaChatbotSetorRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [novoSetor, setNovoSetor] = useState({ nome: '', palavras_chave: '' })
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const [cfg, sts] = await Promise.all([
        rumoWhatsService.carregarChatbotConfig(tenant.id),
        rumoWhatsService.listarSetores(tenant.id),
      ])
      setConfig(cfg)
      setSetores(sts)
    } catch (err) {
      console.error('Erro ao carregar chatbot:', err)
      toast({ title: 'Erro ao carregar configuração do chatbot', variant: 'destructive' })
    } finally {
      setCarregando(false)
    }
  }, [tenant?.id, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  const handleSalvar = async () => {
    if (!tenant?.id || !config) return
    setSalvando(true)
    try {
      const salvo = await rumoWhatsService.salvarChatbotConfig(tenant.id, config, {
        saudacao: config.saudacao,
        menu_texto: config.menu_texto,
        mensagem_invalida: config.mensagem_invalida,
        ativo: !!config.ativo,
        roteamento_modo: config.roteamento_modo,
        setor_padrao: config.setor_padrao,
      })
      setConfig(salvo)
      toast({ title: 'Chatbot salvo', description: 'Triagem ativa para novas conversas.' })
    } catch (err) {
      console.error('Erro ao salvar chatbot:', err)
      toast({ title: 'Erro ao salvar chatbot', variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const handleCriarSetor = async () => {
    if (!tenant?.id || !novoSetor.nome.trim()) return
    try {
      const s = await rumoWhatsService.criarSetor(tenant.id, {
        nome: novoSetor.nome.trim(),
        palavras_chave: novoSetor.palavras_chave.trim(),
        ordem: setores.length,
      })
      setSetores((prev) => [...prev, s])
      setNovoSetor({ nome: '', palavras_chave: '' })
      toast({ title: 'Setor criado', description: s.nome })
    } catch (err) {
      console.error('Erro ao criar setor:', err)
      toast({ title: 'Erro ao criar setor', variant: 'destructive' })
    }
  }

  const handleSalvarSetor = async (s: WaChatbotSetorRecord) => {
    try {
      const atualizado = await rumoWhatsService.atualizarSetor(s.id, {
        nome: s.nome,
        palavras_chave: s.palavras_chave,
        ordem: s.ordem,
        ativo: s.ativo,
      })
      setSetores((prev) => prev.map((x) => (x.id === atualizado.id ? atualizado : x)))
      setEditandoId(null)
      toast({ title: 'Setor atualizado' })
    } catch (err) {
      console.error('Erro ao atualizar setor:', err)
      toast({ title: 'Erro ao atualizar setor', variant: 'destructive' })
    }
  }

  const handleRemoverSetor = async (id: string) => {
    try {
      await rumoWhatsService.removerSetor(id)
      setSetores((prev) => prev.filter((x) => x.id !== id))
      toast({ title: 'Setor removido' })
    } catch (err) {
      console.error('Erro ao remover setor:', err)
      toast({ title: 'Erro ao remover setor', variant: 'destructive' })
    }
  }

  if (carregando) {
    return <div className="py-10 text-center text-sm text-[#64748B]">Carregando chatbot…</div>
  }

  return (
    <div className="space-y-6">
      {/* Saudação, menu e regra de roteamento */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[#0FA3A3]" />
            <div>
              <CardTitle className="text-base">Saudação e roteamento</CardTitle>
              <CardDescription>
                Mensagens automáticas enviadas na entrada da conversa; roteamento por menu digitado
                ou setor padrão.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rumo-chat-saudacao">Saudação</Label>
            <Textarea
              id="rumo-chat-saudacao"
              value={config?.saudacao ?? ''}
              onChange={(e) => setConfig((c) => (c ? { ...c, saudacao: e.target.value } : c))}
              placeholder="Texto enviado junto do menu quando o cliente inicia a conversa."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rumo-chat-menu">Menu de opções (texto)</Label>
            <Textarea
              id="rumo-chat-menu"
              value={config?.menu_texto ?? ''}
              onChange={(e) => setConfig((c) => (c ? { ...c, menu_texto: e.target.value } : c))}
              placeholder={'1 - Setor Fiscal\n2 - Departamento Pessoal\n3 - Contabilidade'}
              rows={4}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rumo-chat-invalida">
              Resposta inválida (mensagem quando não entende)
            </Label>
            <Textarea
              id="rumo-chat-invalida"
              value={config?.mensagem_invalida ?? ''}
              onChange={(e) =>
                setConfig((c) => (c ? { ...c, mensagem_invalida: e.target.value } : c))
              }
              placeholder="Não entendi. Digite o número de uma opção do menu."
              rows={2}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="rumo-chat-ativo"
              checked={!!config?.ativo}
              onCheckedChange={(v) => setConfig((c) => (c ? { ...c, ativo: v } : c))}
            />
            <Label htmlFor="rumo-chat-ativo">Chatbot ativo (triagem no webhook)</Label>
          </div>

          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar chatbot'}
          </Button>
        </CardContent>
      </Card>

      {/* Setores do menu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Setores do menu</CardTitle>
          <CardDescription>
            Palavras-chave separadas por vírgula; a entrada do cliente é comparada a elas para
            rotear a conversa ao setor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Novo setor */}
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1">
              <Label htmlFor="rumo-setor-nome">Nome</Label>
              <Input
                id="rumo-setor-nome"
                value={novoSetor.nome}
                onChange={(e) => setNovoSetor((s) => ({ ...s, nome: e.target.value }))}
                placeholder="Fiscal"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rumo-setor-kw">Palavras-chave</Label>
              <Input
                id="rumo-setor-kw"
                value={novoSetor.palavras_chave}
                onChange={(e) => setNovoSetor((s) => ({ ...s, palavras_chave: e.target.value }))}
                placeholder="nota fiscal, certidão, dívidas"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleCriarSetor} disabled={!novoSetor.nome.trim()}>
                <Plus className="h-4 w-4 mr-1.5" /> Criar setor
              </Button>
            </div>
          </div>

          {/* Lista de setores */}
          {setores.length === 0 ? (
            <p className="text-sm text-[#64748B] py-4 text-center">
              Nenhum setor configurado — crie o primeiro acima.
            </p>
          ) : (
            <div className="rounded-lg border divide-y">
              {setores.map((s, idx) => (
                <div key={s.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{idx + 1}</Badge>
                      <span className="text-sm font-semibold">{s.nome}</span>
                      {!s.ativo && <Badge variant="secondary">inativo</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditandoId(editandoId === s.id ? null : s.id)}
                        aria-label={`Editar setor ${s.nome}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoverSetor(s.id)}
                        aria-label={`Remover setor ${s.nome}`}
                      >
                        <Trash2 className="h-4 w-4 text-[#B3261E]" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#64748B]">
                    <Clock className="h-3 w-3" />
                    {s.palavras_chave || 'sem palavras-chave'}
                  </div>
                  {editandoId === s.id && (
                    <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] pt-2 border-t">
                      <div className="space-y-1">
                        <Label htmlFor={`setor-nome-${s.id}`}>Nome</Label>
                        <Input
                          id={`setor-nome-${s.id}`}
                          value={s.nome}
                          onChange={(e) =>
                            setSetores((prev) =>
                              prev.map((x) => (x.id === s.id ? { ...x, nome: e.target.value } : x)),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`setor-kw-${s.id}`}>Palavras-chave</Label>
                        <Input
                          id={`setor-kw-${s.id}`}
                          value={s.palavras_chave || ''}
                          onChange={(e) =>
                            setSetores((prev) =>
                              prev.map((x) =>
                                x.id === s.id ? { ...x, palavras_chave: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="flex items-end">
                        <Button size="sm" onClick={() => handleSalvarSetor(s)}>
                          Salvar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-[#64748B]">
            Ordem do menu segue o campo <code>ordem</code> — a entrada numérica (&quot;1&quot;,
            &quot;2&quot;…) roteia para o setor correspondente. A regra de roteamento do chatbot é:{' '}
            {config?.roteamento_modo === 'setor_padrao' ? 'setor padrão' : 'menu digitado'}.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

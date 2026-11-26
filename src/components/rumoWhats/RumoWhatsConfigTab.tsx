import { useCallback, useEffect, useState } from 'react'
import { Calendar, Clock, Save } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import {
  rumoWhatsService,
  DIAS_SEMANA,
  MSG_BOAS_VINDAS_PADRAO,
  MSG_FORA_HORARIO_PADRAO,
  MSG_POSICAO_FILA_PADRAO,
  type WaChatbotConfigRecord,
} from '@/services/rumoWhats'
import { useToast } from '@/hooks/use-toast'
import { RumoWhatsConectorCard } from '@/components/rumoWhats/RumoWhatsConectorCard'

/**
 * Tela 05 — Configurações: grade de dias/horários de atendimento e mensagens
 * automáticas (boas-vindas, fora de horário, posição na fila). O webhook
 * rumo_whats.js consome exatamente estes campos na entrada da conversa.
 */
export function RumoWhatsConfigTab() {
  const { tenant } = useAuth()
  const { toast } = useToast()
  const [config, setConfig] = useState<WaChatbotConfigRecord | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const cfg = await rumoWhatsService.carregarChatbotConfig(tenant.id)
      setConfig(cfg)
    } catch (err) {
      console.error('Erro ao carregar configurações:', err)
      toast({ title: 'Erro ao carregar configurações', variant: 'destructive' })
    } finally {
      setCarregando(false)
    }
  }, [tenant?.id, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  const handleSalvar = async () => {
    if (!tenant?.id) return
    setSalvando(true)
    try {
      const dados: Partial<WaChatbotConfigRecord> = {
        horario_inicio: config?.horario_inicio || '08:00',
        horario_fim: config?.horario_fim || '18:00',
        dias_atendimento: config?.dias_atendimento || ['seg', 'ter', 'qua', 'qui', 'sex'],
        msg_boas_vindas: config?.msg_boas_vindas || MSG_BOAS_VINDAS_PADRAO,
        msg_fora_horario: config?.msg_fora_horario || MSG_FORA_HORARIO_PADRAO,
        msg_posicao_fila: config?.msg_posicao_fila || MSG_POSICAO_FILA_PADRAO,
      }
      const salvo = await rumoWhatsService.salvarChatbotConfig(tenant.id, config, dados)
      setConfig(salvo)
      toast({
        title: 'Configurações salvas',
        description: 'Horários e mensagens automáticas aplicados ao atendimento.',
      })
    } catch (err) {
      console.error('Erro ao salvar configurações:', err)
      toast({ title: 'Erro ao salvar configurações', variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const toggleDia = (dia: string) => {
    setConfig((c) => {
      const atual = c?.dias_atendimento || []
      const dias = atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia]
      return c ? { ...c, dias_atendimento: dias } : c
    })
  }

  if (carregando) {
    return <div className="py-10 text-center text-sm text-[#64748B]">Carregando configurações…</div>
  }

  const dias = config?.dias_atendimento || []

  return (
    <div className="space-y-6">
      {/* Conector: URL pública (túnel HTTPS) guardada no canal */}
      <RumoWhatsConectorCard />

      {/* Horários de atendimento */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#0FA3A3]" />
            <div>
              <CardTitle className="text-base">Horários de atendimento</CardTitle>
              <CardDescription>
                Fora deste horário, a conversa recebe a mensagem automática de fora do horário.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="rumo-horario-inicio">Início</Label>
              <Input
                id="rumo-horario-inicio"
                type="time"
                value={config?.horario_inicio || '08:00'}
                onChange={(e) =>
                  setConfig((c) => (c ? { ...c, horario_inicio: e.target.value } : c))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rumo-horario-fim">Fim</Label>
              <Input
                id="rumo-horario-fim"
                type="time"
                value={config?.horario_fim || '18:00'}
                onChange={(e) => setConfig((c) => (c ? { ...c, horario_fim: e.target.value } : c))}
              />
            </div>
          </div>

          <fieldset>
            <legend className="text-sm font-medium mb-2">Dias de atendimento</legend>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((d) => {
                const ativo = dias.includes(d.valor)
                return (
                  <button
                    key={d.valor}
                    type="button"
                    onClick={() => toggleDia(d.valor)}
                    aria-pressed={ativo}
                    aria-label={`Dia de atendimento: ${d.rotulo}`}
                    className={
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#0FA3A3] ' +
                      (ativo
                        ? 'bg-[#0FA3A3]/10 border-[#0FA3A3]/40 text-[#0FA3A3]'
                        : 'border-[#E2E8F0] text-[#64748B] hover:bg-slate-50')
                    }
                  >
                    {d.rotulo}
                  </button>
                )
              })}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      {/* Mensagens automáticas */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#0FA3A3]" />
            <div>
              <CardTitle className="text-base">Mensagens automáticas</CardTitle>
              <CardDescription>
                Enviadas pelo webhook na entrada da conversa conforme a situação.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rumo-msg-boas-vindas">Boas-vindas (entrada da conversa)</Label>
            <Textarea
              id="rumo-msg-boas-vindas"
              value={config?.msg_boas_vindas ?? MSG_BOAS_VINDAS_PADRAO}
              onChange={(e) =>
                setConfig((c) => (c ? { ...c, msg_boas_vindas: e.target.value } : c))
              }
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rumo-msg-fora-horario">Fora do horário</Label>
            <Textarea
              id="rumo-msg-fora-horario"
              value={config?.msg_fora_horario ?? MSG_FORA_HORARIO_PADRAO}
              onChange={(e) =>
                setConfig((c) => (c ? { ...c, msg_fora_horario: e.target.value } : c))
              }
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rumo-msg-posicao-fila">
              Posição na fila (aceita <code>{'{posicao}'}</code>)
            </Label>
            <Textarea
              id="rumo-msg-posicao-fila"
              value={config?.msg_posicao_fila ?? MSG_POSICAO_FILA_PADRAO}
              onChange={(e) =>
                setConfig((c) => (c ? { ...c, msg_posicao_fila: e.target.value } : c))
              }
              rows={2}
            />
          </div>

          <Button onClick={handleSalvar} disabled={salvando}>
            <Save className="h-4 w-4 mr-1.5" />
            {salvando ? 'Salvando…' : 'Salvar configurações'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

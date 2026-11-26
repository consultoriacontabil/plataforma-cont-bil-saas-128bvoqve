import { useCallback, useEffect, useState } from 'react'
import { Calendar, Clock, Save } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/AuthContext'
import {
  rumoWhatsService,
  DIAS_SEMANA,
  type WaChatbotConfigRecord,
} from '@/services/rumoWhats'
import { useToast } from '@/hooks/use-toast'

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

  const carregar = useCallback(async () => wa_chatbot_config placeholder)
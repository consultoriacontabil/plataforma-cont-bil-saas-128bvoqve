import pb from '@/lib/pocketbase/client'
import type { AgentConversationRecord, AgentMessageRecord } from '@/types'

export interface EllizaRotinaItem {
  id: string
  nome: string
  frequencia?: string
  dependencia?: string
  status: string
  descricao: string
}

export interface EllizaStatusResponse {
  agente: {
    slug: string
    nome: string
    versao: string
    plataforma: string
    modo: string
    padrao_conformidade: string
  }
  limites_estabelecidos: {
    rpa_visual: boolean
    vm_externa: boolean
    desktop_legado_dominio: boolean
    infraestrutura_24h: string
  }
  rotinas_ativas_24_7: EllizaRotinaItem[]
  rotinas_aguardando_credenciais: EllizaRotinaItem[]
  metricas_tenant: {
    total_empresas: number
    total_certificados: number
    certificados_ativos: number
    obrigacoes_pendentes: number
    obrigacoes_atrasadas: number
  }
}

export interface EnviarMensagemEllizaParams {
  mensagem: string
  conversationId?: string | null
  tenantId: string
  onChunk?: (chunk: string, acumulado: string) => void
  signal?: AbortSignal
}

export const ellizaAgentService = {
  /**
   * Consulta o status operacional da ELLIZA, rotinas 24/7 e limites acordados
   */
  async getStatus(tenantId?: string): Promise<EllizaStatusResponse> {
    const url = new URL(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/elliza/status`)
    if (tenantId) {
      url.searchParams.set('tenant_id', tenantId)
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: pb.authStore.token,
      },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Erro HTTP ${res.status} ao consultar status da ELLIZA`)
    }

    return res.json()
  },

  /**
   * Cria ou obtém conversa com a ELLIZA
   */
  async criarConversa(title: string, tenantId: string): Promise<AgentConversationRecord> {
    const res = await fetch(
      `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/elliza/conversations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify({ title, tenant_id: tenantId }),
      },
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Erro HTTP ${res.status} ao criar conversa com ELLIZA`)
    }

    return res.json()
  },

  /**
   * Lista histórico de conversas do usuário autenticado
   */
  async listarConversas(userId: string): Promise<AgentConversationRecord[]> {
    return pb.collection('agent_conversations').getFullList<AgentConversationRecord>({
      filter: `user_id = "${userId}"`,
      sort: '-created',
    })
  },

  /**
   * Lista mensagens de uma conversa
   */
  async listarMensagens(conversationId: string): Promise<AgentMessageRecord[]> {
    return pb.collection('agent_messages').getFullList<AgentMessageRecord>({
      filter: `conversation_id = "${conversationId}"`,
      sort: 'created',
    })
  },

  /**
   * Envia mensagem para a ELLIZA via SSE streaming
   */
  async enviarMensagem({
    mensagem,
    conversationId,
    tenantId,
    onChunk,
    signal,
  }: EnviarMensagemEllizaParams): Promise<{
    conteudo: string
    conversationId: string
  }> {
    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/elliza/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify({
        message: mensagem,
        conversation_id: conversationId,
        tenant_id: tenantId,
      }),
      signal,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Erro HTTP ${res.status} no chat da ELLIZA`)
    }

    const resolvedConvId = res.headers.get('X-Conversation-Id') || conversationId || ''
    let acumulado = ''

    if (res.body) {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let done = false

      while (!done) {
        const { value, done: doneReading } = await reader.read()
        done = doneReading
        if (value) {
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim()
              if (dataStr === '[DONE]') break
              try {
                const parsed = JSON.parse(dataStr)
                const token =
                  parsed.token ?? parsed.choices?.[0]?.delta?.content ?? parsed.content ?? ''
                acumulado += token
                onChunk?.(token, acumulado)
              } catch {
                acumulado += dataStr
                onChunk?.(dataStr, acumulado)
              }
            }
          }
        }
      }
    }

    return {
      conteudo: acumulado.trim(),
      conversationId: resolvedConvId,
    }
  },
}

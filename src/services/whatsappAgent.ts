import pb from '@/lib/pocketbase/client'
import type {
  WaAtendimentoConversaRecord,
  WaAtendimentoMensagemRecord,
  NfseConfigRecord,
} from '@/types'
import { auditService } from './audit'

export interface SalvarConfigIaInput {
  ia_ativa: boolean
  ia_modo_operacao: 'supervisionado' | 'autonomo_duvidas'
  ia_mensagem_boas_vindas?: string
  ia_horario_inicio?: string
  ia_horario_fim?: string
  ia_mensagem_fora_horario?: string
}

export interface TestarAgenteIaInput {
  tenantId: string
  mensagem: string
  empresaId?: string
}

export interface TestarAgenteIaResponse {
  sucesso: boolean
  resposta: string
  citacoes?: any[]
  conversation_id?: string
  message_id?: string
  tempo_resposta?: string
}

export interface EnviarMensagemWaInput {
  conversaId: string
  conteudo: string
  mensagemId?: string
}

export const whatsappAgentService = {
  /**
   * Lista as conversas atendidas pelo Agente de IA / Humano
   */
  async listConversas(
    tenantId: string,
    filtros?: {
      status?: string
      empresaId?: string
      busca?: string
    },
  ): Promise<WaAtendimentoConversaRecord[]> {
    let filter = `tenant_id = "${tenantId}"`
    if (filtros?.status && filtros.status !== 'todos') {
      filter += ` && status = "${filtros.status}"`
    }
    if (filtros?.empresaId && filtros.empresaId !== 'todas') {
      filter += ` && empresa = "${filtros.empresaId}"`
    }

    const records = await pb
      .collection('wa_atendimento_conversas')
      .getFullList<WaAtendimentoConversaRecord>({
        filter,
        sort: '-ultima_interacao',
        expand: 'empresa,solicitacao_nfse,atendente_humano',
      })

    if (filtros?.busca?.trim()) {
      const q = filtros.busca.toLowerCase()
      return records.filter(
        (c) =>
          c.contato_nome.toLowerCase().includes(q) ||
          c.contato_telefone.includes(q) ||
          c.ultima_mensagem?.toLowerCase().includes(q) ||
          c.expand?.empresa?.razao_social.toLowerCase().includes(q) ||
          c.expand?.empresa?.nome_fantasia?.toLowerCase().includes(q),
      )
    }

    return records
  },

  /**
   * Lista mensagens de uma conversa específica em ordem cronológica
   */
  async listMensagens(conversaId: string): Promise<WaAtendimentoMensagemRecord[]> {
    return pb.collection('wa_atendimento_mensagens').getFullList<WaAtendimentoMensagemRecord>({
      filter: `conversa = "${conversaId}"`,
      sort: 'created',
      expand: 'aprovado_por',
    })
  },

  /**
   * Atualiza as configurações do Agente de IA
   */
  async salvarConfigIa(
    configId: string,
    tenantId: string,
    input: SalvarConfigIaInput,
    userId?: string,
  ): Promise<NfseConfigRecord> {
    const updated = await pb.collection('nfse_config').update<NfseConfigRecord>(configId, {
      ...input,
    })

    await auditService.log(
      tenantId,
      userId || 'system',
      'whatsapp_agent_config_atualizada',
      'nfse_config',
      configId,
      JSON.stringify(input),
    )

    return updated
  },

  /**
   * Testar o agente nativo em tempo real simulando uma pergunta de cliente
   */
  async testarAgente(input: TestarAgenteIaInput): Promise<TestarAgenteIaResponse> {
    const res = await pb.send('/backend/v1/whatsapp-agent/test', {
      method: 'POST',
      body: {
        tenant_id: input.tenantId,
        mensagem: input.mensagem,
        empresa_id: input.empresaId,
      },
    })
    return res as TestarAgenteIaResponse
  },

  /**
   * Envia uma mensagem humana ou aprova uma resposta sugerida pela IA
   */
  async enviarMensagem(
    input: EnviarMensagemWaInput,
  ): Promise<{ sucesso: boolean; evolution_dispatch?: string }> {
    const res = await pb.send('/backend/v1/whatsapp-agent/mensagens/enviar', {
      method: 'POST',
      body: {
        conversa_id: input.conversaId,
        conteudo: input.conteudo,
        mensagem_id: input.mensagemId,
      },
    })
    return res as { sucesso: boolean; evolution_dispatch?: string }
  },

  /**
   * Encerra ou altera o status de uma conversa
   */
  async atualizarStatusConversa(
    conversaId: string,
    status: WaAtendimentoConversaRecord['status'],
    userId?: string,
  ): Promise<WaAtendimentoConversaRecord> {
    const data: Record<string, any> = { status }
    if (userId) data.atendente_humano = userId
    return pb
      .collection('wa_atendimento_conversas')
      .update<WaAtendimentoConversaRecord>(conversaId, data)
  },
}

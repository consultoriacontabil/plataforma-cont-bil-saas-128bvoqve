import pb from '@/lib/pocketbase/client'
import type {
  WaCanalRecord,
  WaAtendimentoConversaRecord,
  WaAtendimentoMensagemRecord,
} from '@/types'

/**
 * Rumo Whats — serviço do painel do atendente (/extensao).
 * Conversas em wa_atendimento_conversas, mensagens em wa_atendimento_mensagens,
 * canal (número pareado por QR) em wa_canais.
 */

const CONVERSAS = 'wa_atendimento_conversas'
const MENSAGENS = 'wa_atendimento_mensagens'
const CANAIS = 'wa_canais'

export interface ConectorEstado {
  conectado: boolean
  tem_qr: boolean
  numero_pareado: string | null
  ultimo_erro: string | null
  qr_atualizado_em?: string | null
  conectado_em?: string | null
  iniciado_em?: string | null
  canal_id?: string | null
}

export const rumoWhatsService = {
  // ------------------------------------------------------------------
  // Canal (wa_canais)
  // ------------------------------------------------------------------
  async listarCanais(tenantId: string): Promise<WaCanalRecord[]> {
    return pb.collection(CANAIS).getFullList({
      filter: `tenant_id = "${tenantId}"`,
      sort: '-created',
    })
  },

  async criarCanal(
    tenantId: string,
    dados: { nome: string; telefone: string; conectorUrl?: string },
  ): Promise<WaCanalRecord> {
    return pb.collection(CANAIS).create({
      tenant_id: tenantId,
      nome: dados.nome,
      telefone: dados.telefone,
      modo: 'qr',
      status: 'aguardando_qr',
      finalidade: 'atendimento',
      conector_url: dados.conectorUrl || '',
    })
  },

  async atualizarCanal(
    id: string,
    dados: Partial<
      Pick<WaCanalRecord, 'status' | 'numero_pareado' | 'ultimo_erro' | 'conector_url'>
    >,
  ): Promise<WaCanalRecord> {
    return pb.collection(CANAIS).update(id, dados)
  },

  // ------------------------------------------------------------------
  // Conversas e mensagens
  // ------------------------------------------------------------------
  async listarConversas(tenantId: string): Promise<WaAtendimentoConversaRecord[]> {
    return pb.collection(CONVERSAS).getFullList({
      filter: `tenant_id = "${tenantId}"`,
      sort: '-ultima_interacao',
    })
  },

  async listarMensagens(conversaId: string): Promise<WaAtendimentoMensagemRecord[]> {
    return pb.collection(MENSAGENS).getFullList({
      filter: `conversa = "${conversaId}"`,
      sort: 'created',
    })
  },

  /** Enfileira uma mensagem do atendente: status_envio "pendente" — o laço de envio do conector despacha. */
  async enfileirarMensagem(
    tenantId: string,
    conversaId: string,
    conteudo: string,
    canalId?: string,
  ): Promise<WaAtendimentoMensagemRecord> {
    return pb.collection(MENSAGENS).create({
      tenant_id: tenantId,
      conversa: conversaId,
      remetente_tipo: 'humano',
      conteudo,
      status_envio: 'pendente',
      ...(canalId ? { canal: canalId } : {}),
    })
  },

  async marcarMensagemFalha(id: string): Promise<WaAtendimentoMensagemRecord> {
    return pb.collection(MENSAGENS).update(id, { status_envio: 'falha' })
  },

  async atualizarConversa(
    id: string,
    dados: Partial<Pick<WaAtendimentoConversaRecord, 'status' | 'atendente_humano'>>,
  ): Promise<WaAtendimentoConversaRecord> {
    return pb.collection(CONVERSAS).update(id, dados)
  },

  // ------------------------------------------------------------------
  // Conector (processo Node na máquina do escritório)
  // ------------------------------------------------------------------
  conectorUrl(): string {
    return (import.meta.env.VITE_WA_CONECTOR_URL as string | undefined) || ''
  },

  async estadoConector(): Promise<
    { ok: true; estado: ConectorEstado } | { ok: false; erro: string }
  > {
    const base = this.conectorUrl().replace(/\/$/, '')
    if (!base) {
      return {
        ok: false,
        erro: 'Conector não configurado: defina VITE_WA_CONECTOR_URL apontando para o processo Node (ex. http://127.0.0.1:8095).',
      }
    }
    try {
      const resp = await fetch(base + '/estado', { signal: AbortSignal.timeout(6000) })
      if (!resp.ok) return { ok: false, erro: `Conector respondeu HTTP ${resp.status}.` }
      const estado = (await resp.json()) as ConectorEstado
      return { ok: true, estado }
    } catch (err) {
      return {
        ok: false,
        erro: 'Conector offline. Suba o processo Node na máquina do escritório (tools/conector-whatsapp).',
      }
    }
  },

  qrUrl(): string {
    const base = this.conectorUrl().replace(/\/$/, '')
    return base ? `${base}/qr.png?t=${Date.now()}` : ''
  },

  async recarregarSessao(): Promise<{ ok: boolean; erro?: string }> {
    const base = this.conectorUrl().replace(/\/$/, '')
    if (!base) return { ok: false, erro: 'Conector não configurado (VITE_WA_CONECTOR_URL).' }
    try {
      const resp = await fetch(base + '/recarregar', {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
      })
      if (!resp.ok) return { ok: false, erro: `Conector respondeu HTTP ${resp.status}.` }
      return { ok: true }
    } catch {
      return { ok: false, erro: 'Conector offline — não foi possível recarregar a sessão.' }
    }
  },
}

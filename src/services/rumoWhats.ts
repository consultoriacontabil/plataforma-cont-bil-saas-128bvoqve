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
 *
 * Telas 03/04/05/06 (v1.1.0):
 * - wa_chatbot_config / wa_chatbot_setores — chatbot e roteamento (Tela 03)
 * - wa_whats_transmissoes / wa_whats_disparos — listas de transmissão (Tela 04),
 *   cujo disparo é despachado como TAREFA para o agente externo Elliza (ZAP) —
 *   a plataforma nunca envia WhatsApp direto.
 * - Configurações (Tela 05) compartilham wa_chatbot_config.
 * - Relatórios (Tela 06) agregam conversas/mensagens existentes.
 */

const CONVERSAS = 'wa_atendimento_conversas'
const MENSAGENS = 'wa_atendimento_mensagens'
const CANAIS = 'wa_canais'
const CHATBOT_CONFIG = 'wa_chatbot_config'
const CHATBOT_SETORES = 'wa_chatbot_setores'
const TRANSMISSOES = 'wa_whats_transmissoes'
const DISPAROS = 'wa_whats_disparos'

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

// ---------------------------------------------------------------------------
// Tipos das novas coleções (criadas na migration 0166)
// ---------------------------------------------------------------------------
export interface WaChatbotSetorRecord {
  id: string
  tenant_id: string
  nome: string
  descricao?: string
  palavras_chave?: string
  ordem?: number
  ativo: boolean
  atendente?: string
  created?: string
  updated?: string
  expand?: { atendente?: { id: string; name: string } }
}

export interface WaChatbotConfigRecord {
  id: string
  tenant_id: string
  saudacao?: string
  menu_texto?: string
  mensagem_invalida?: string
  roteamento_modo?: 'menu_digitado' | 'setor_padrao'
  setor_padrao?: string
  ativo?: boolean
  horario_inicio?: string
  horario_fim?: string
  dias_atendimento?: string[] | null
  msg_boas_vindas?: string
  msg_fora_horario?: string
  msg_posicao_fila?: string
  expand?: { setor_padrao?: WaChatbotSetorRecord }
}

export interface TransmissaoDestinatario {
  nome: string
  telefone: string
}

export interface WaWhatsTransmissaoRecord {
  id: string
  tenant_id: string
  nome: string
  mensagem: string
  destinatarios: TransmissaoDestinatario[] | null
  status: 'rascunho' | 'despachada' | 'em_execucao' | 'concluida' | 'falha'
  canal?: string
  total_destinatarios?: number
  despachada_em?: string | null
  concluida_em?: string | null
  created?: string
  updated?: string
  expand?: { canal?: WaCanalRecord }
}

export interface WaWhatsDisparoRecord {
  id: string
  tenant_id: string
  transmissao?: string
  documento_doc?: string
  documento_nome?: string
  origem: 'transmissao' | 'documento'
  origem_id?: string
  modulo_origem?: string
  destinatario_nome?: string
  telefone: string
  mensagem: string
  status: 'pendente' | 'enviada' | 'falha' | 'cancelada'
  enviada_em?: string | null
  wamid?: string
  erro?: string
  created?: string
  updated?: string
}

export const DIAS_SEMANA = [
  { valor: 'seg', rotulo: 'Segunda' },
  { valor: 'ter', rotulo: 'Terça' },
  { valor: 'qua', rotulo: 'Quarta' },
  { valor: 'qui', rotulo: 'Quinta' },
  { valor: 'sex', rotulo: 'Sexta' },
  { valor: 'sab', rotulo: 'Sábado' },
  { valor: 'dom', rotulo: 'Domingo' },
] as const

export const SAUDACAO_PADRAO =
  'Olá! Sou o assistente virtual da nossa contabilidade. Selecione uma opção para continuar:'

export const MENU_PADRAO =
  '1 - Setor Fiscal\n2 - Departamento Pessoal\n3 - Contabilidade\n4 - Financeiro\n5 - Outros assuntos'

export const MENSAGEM_INVALIDA_PADRAO =
  'Não entendi. Digite o número de uma opção do menu (1 a 5) para eu te direcionar ao setor certo.'

export const MSG_BOAS_VINDAS_PADRAO =
  'Bem-vindo(a)! Recebemos sua mensagem e um atendente vai te responder em instantes.'

export const MSG_FORA_HORARIO_PADRAO =
  'No momento estamos fora do horário de atendimento. Sua mensagem foi registrada e responderemos no próximo dia útil.'

export const MSG_POSICAO_FILA_PADRAO =
  'Você está na fila de atendimento. Sua posição: {posicao}. Aguarde um instante, por favor.'

export function configPadrao() {
  return {
    saudacao: SAUDACAO_PADRAO,
    menu_texto: MENU_PADRAO,
    mensagem_invalida: MENSAGEM_INVALIDA_PADRAO,
    roteamento_modo: 'menu_digitado' as const,
    ativo: true,
    horario_inicio: '08:00',
    horario_fim: '18:00',
    dias_atendimento: ['seg', 'ter', 'qua', 'qui', 'sex'],
    msg_boas_vindas: MSG_BOAS_VINDAS_PADRAO,
    msg_fora_horario: MSG_FORA_HORARIO_PADRAO,
    msg_posicao_fila: MSG_POSICAO_FILA_PADRAO,
  }
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
  // Tela 03 — Chatbot e roteamento (wa_chatbot_config / wa_chatbot_setores)
  // ------------------------------------------------------------------
  async carregarChatbotConfig(tenantId: string): Promise<WaChatbotConfigRecord | null> {
    try {
      const r = await pb.collection(CHATBOT_CONFIG).getFirstListItem(`tenant_id = "${tenantId}"`, {
        expand: 'setor_padrao',
      })
      return r as unknown as WaChatbotConfigRecord
    } catch {
      return null
    }
  },

  async salvarChatbotConfig(
    tenantId: string,
    existente: WaChatbotConfigRecord | null,
    dados: Partial<WaChatbotConfigRecord>,
  ): Promise<WaChatbotConfigRecord> {
    if (existente) {
      return pb
        .collection(CHATBOT_CONFIG)
        .update(existente.id, dados) as unknown as Promise<WaChatbotConfigRecord>
    }
    return pb.collection(CHATBOT_CONFIG).create({
      tenant_id: tenantId,
      ...configPadrao(),
      ...dados,
    }) as unknown as Promise<WaChatbotConfigRecord>
  },

  async listarSetores(tenantId: string): Promise<WaChatbotSetorRecord[]> {
    return pb
      .collection(CHATBOT_SETORES)
      .getFullList({
        filter: `tenant_id = "${tenantId}"`,
        sort: 'ordem,nome',
        expand: 'atendente',
      })
      .then((rs) => rs as unknown as WaChatbotSetorRecord[])
  },

  async criarSetor(
    tenantId: string,
    dados: Pick<WaChatbotSetorRecord, 'nome'> &
      Partial<Pick<WaChatbotSetorRecord, 'descricao' | 'palavras_chave' | 'ordem' | 'atendente'>>,
  ): Promise<WaChatbotSetorRecord> {
    return pb.collection(CHATBOT_SETORES).create({
      tenant_id: tenantId,
      nome: dados.nome,
      descricao: dados.descricao || '',
      palavras_chave: dados.palavras_chave || '',
      ordem: dados.ordem ?? 0,
      ativo: true,
      ...(dados.atendente ? { atendente: dados.atendente } : {}),
    }) as unknown as Promise<WaChatbotSetorRecord>
  },

  async atualizarSetor(
    id: string,
    dados: Partial<WaChatbotSetorRecord>,
  ): Promise<WaChatbotSetorRecord> {
    return pb
      .collection(CHATBOT_SETORES)
      .update(id, dados) as unknown as Promise<WaChatbotSetorRecord>
  },

  async removerSetor(id: string): Promise<void> {
    await pb.collection(CHATBOT_SETORES).delete(id)
  },

  // ------------------------------------------------------------------
  // Tela 04 — Listas de transmissão (tarefa para o agente externo Elliza)
  // ------------------------------------------------------------------
  async listarTransmissoes(tenantId: string): Promise<WaWhatsTransmissaoRecord[]> {
    return pb
      .collection(TRANSMISSOES)
      .getFullList({
        filter: `tenant_id = "${tenantId}"`,
        sort: '-created',
        expand: 'canal',
      })
      .then((rs) => rs as unknown as WaWhatsTransmissaoRecord[])
  },

  async criarTransmissao(
    tenantId: string,
    dados: {
      nome: string
      mensagem: string
      destinatarios: TransmissaoDestinatario[]
      canalId?: string
    },
  ): Promise<WaWhatsTransmissaoRecord> {
    return pb.collection(TRANSMISSOES).create({
      tenant_id: tenantId,
      nome: dados.nome,
      mensagem: dados.mensagem,
      destinatarios: dados.destinatarios,
      status: 'rascunho',
      total_destinatarios: dados.destinatarios.length,
      ...(dados.canalId ? { canal: dados.canalId } : {}),
    }) as unknown as Promise<WaWhatsTransmissaoRecord>
  },

  async atualizarTransmissao(
    id: string,
    dados: Partial<
      Pick<WaWhatsTransmissaoRecord, 'nome' | 'mensagem' | 'destinatarios' | 'status'>
    >,
  ): Promise<WaWhatsTransmissaoRecord> {
    return pb
      .collection(TRANSMISSOES)
      .update(id, dados) as unknown as Promise<WaWhatsTransmissaoRecord>
  },

  async removerTransmissao(id: string): Promise<void> {
    await pb.collection(TRANSMISSOES).delete(id)
  },

  /**
   * Despacha a transmissão: cria um registro de disparo pendente por destinatário
   * (wa_whats_disparos) — é a TAREFA que o agente externo Elliza (ZAP da ELLIZA desktop)
   * consome e executa. A plataforma nunca envia WhatsApp direto.
   */
  async despacharTransmissao(tenantId: string, t: WaWhatsTransmissaoRecord): Promise<number> {
    const destinatarios = t.destinatarios || []
    for (const d of destinatarios) {
      await pb.collection(DISPAROS).create({
        tenant_id: tenantId,
        transmissao: t.id,
        origem: 'transmissao',
        origem_id: t.id,
        destinatario_nome: d.nome,
        telefone: d.telefone,
        mensagem: t.mensagem,
        status: 'pendente',
      })
    }
    await pb.collection(TRANSMISSOES).update(t.id, {
      status: 'despachada',
      ...(t.status === 'concluida' ? {} : {}),
    })
    return destinatarios.length
  },

  async listarDisparos(
    tenantId: string,
    filtro?: { transmissaoId?: string },
  ): Promise<WaWhatsDisparoRecord[]> {
    let filter = `tenant_id = "${tenantId}"`
    if (filtro?.transmissaoId) filter += ` && transmissao = "${filtro.transmissaoId}"`
    return pb
      .collection(DISPAROS)
      .getFullList({ filter, sort: '-created' })
      .then((rs) => rs as unknown as WaWhatsDisparoRecord[])
  },

  async cancelarDisparo(id: string): Promise<WaWhatsDisparoRecord> {
    return pb
      .collection(DISPAROS)
      .update(id, { status: 'cancelada' }) as unknown as Promise<WaWhatsDisparoRecord>
  },

  // ------------------------------------------------------------------
  // Tela 07 — Envio de documentos (tarefa para o agente externo Elliza)
  // ------------------------------------------------------------------
  async enfileirarDocumento(
    tenantId: string,
    dados: {
      telefone: string
      destinatarioNome?: string
      mensagem: string
      documentoNome: string
      documentoDocId?: string
      moduloOrigem: 'pessoal' | 'fiscal' | 'contabil' | 'financeiro'
      origemId?: string
    },
  ): Promise<WaWhatsDisparoRecord> {
    return pb.collection(DISPAROS).create({
      tenant_id: tenantId,
      origem: 'documento',
      origem_id: dados.origemId || '',
      modulo_origem: dados.moduloOrigem,
      documento_doc: dados.documentoDocId || '',
      documento_nome: dados.documentoNome,
      destinatario_nome: dados.destinatarioNome || '',
      telefone: dados.telefone,
      mensagem: dados.mensagem,
      status: 'pendente',
    }) as unknown as Promise<WaWhatsDisparoRecord>
  },

  // ------------------------------------------------------------------
  // Tela 06 — Relatórios (agregações client-side sobre conversas/mensagens)
  // ------------------------------------------------------------------
  async listarMensagensPeriodo(
    tenantId: string,
    desdeISO: string,
  ): Promise<WaAtendimentoMensagemRecord[]> {
    return pb.collection(MENSAGENS).getFullList({
      filter: `tenant_id = "${tenantId}" && created >= "${desdeISO}"`,
      sort: 'created',
    })
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

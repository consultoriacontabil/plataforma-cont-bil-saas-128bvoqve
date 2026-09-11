import pb from '@/lib/pocketbase/client'
import type { WhatsAppLeadContatoRecord, WhatsAppTemplateRecord, StatusCapturaLead } from '@/types'
import { auditService } from './audit'

export interface CreateWhatsAppLeadInput {
  tenant_id: string
  nome_contato: string
  telefone: string
  origem_chat_jid?: string
  empresa_associada?: string
  status_captura?: StatusCapturaLead
  observacoes?: string
  dados_extras?: Record<string, unknown>
  capturado_por?: string
}

export const whatsappService = {
  /**
   * Lista contatos e leads capturados no tenant
   */
  async listLeads(tenantId: string, filter?: string): Promise<WhatsAppLeadContatoRecord[]> {
    let combinedFilter = `tenant_id = "${tenantId}"`
    if (filter) {
      combinedFilter += ` && (${filter})`
    }
    return pb.collection('whatsapp_leads_contatos').getFullList<WhatsAppLeadContatoRecord>({
      filter: combinedFilter,
      sort: '-created',
      expand: 'empresa_associada,capturado_por',
    })
  },

  /**
   * Cria registro de lead capturado via extensão ou tela
   */
  async createLead(data: CreateWhatsAppLeadInput): Promise<WhatsAppLeadContatoRecord> {
    const record = await pb
      .collection('whatsapp_leads_contatos')
      .create<WhatsAppLeadContatoRecord>({
        tenant_id: data.tenant_id,
        nome_contato: data.nome_contato.trim(),
        telefone: data.telefone.trim(),
        origem_chat_jid: data.origem_chat_jid || '',
        empresa_associada: data.empresa_associada || null,
        status_captura: data.status_captura || 'capturado',
        observacoes: data.observacoes || '',
        dados_extras: data.dados_extras || {},
        capturado_por: data.capturado_por || null,
      })

    // Registrar auditoria
    await auditService.log(
      data.tenant_id,
      data.capturado_por || 'system',
      'whatsapp_contato_capturado',
      'whatsapp_leads_contatos',
      record.id,
      JSON.stringify({
        nome: data.nome_contato,
        telefone: data.telefone,
        empresa_associada: data.empresa_associada,
      }),
    )

    return record
  },

  /**
   * Associa lead a uma empresa existente
   */
  async associarEmpresa(
    leadId: string,
    empresaId: string,
    userId?: string,
    tenantId?: string,
  ): Promise<WhatsAppLeadContatoRecord> {
    const updated = await pb
      .collection('whatsapp_leads_contatos')
      .update<WhatsAppLeadContatoRecord>(leadId, {
        empresa_associada: empresaId,
        status_captura: 'empresa_vinculada',
      })

    if (tenantId) {
      await auditService.log(
        tenantId,
        userId || 'system',
        'whatsapp_contato_vinculado_empresa',
        'whatsapp_leads_contatos',
        leadId,
        JSON.stringify({ empresa_associada: empresaId }),
      )
    }

    return updated
  },

  /**
   * Lista modelos de mensagens cadastrados
   */
  async listTemplates(tenantId: string): Promise<WhatsAppTemplateRecord[]> {
    return pb.collection('whatsapp_templates').getFullList<WhatsAppTemplateRecord>({
      filter: `tenant_id = "${tenantId}" && ativo = true`,
      sort: '-created',
    })
  },

  /**
   * Cria ou customiza novo template de mensagem
   */
  async createTemplate(
    tenantId: string,
    titulo: string,
    categoria: WhatsAppTemplateRecord['categoria'],
    conteudo: string,
  ): Promise<WhatsAppTemplateRecord> {
    return pb.collection('whatsapp_templates').create<WhatsAppTemplateRecord>({
      tenant_id: tenantId,
      titulo: titulo.trim(),
      categoria,
      conteudo: conteudo.trim(),
      ativo: true,
    })
  },
}

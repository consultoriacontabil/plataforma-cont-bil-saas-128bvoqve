import pb from '@/lib/pocketbase/client'
import { auditService } from '@/services/audit'
import { whatsappAtivoService } from '@/services/whatsappAtivo'
import type { PedidoDocumentoRecord, ItemStatusPedidoDocumento, Documento } from '@/types'

export interface CriarPedidoDocumentoInput {
  tenant_id: string
  empresa: string
  competencia: string // MM/AAAA
  tipos_solicitados: string[]
  itens: Array<{
    tipo: 'extratos' | 'cartoes' | 'maquininhas' | 'credito'
    detalhe: string
    banco_conta_id?: string
    plataforma?: string
  }>
  dias_expiracao?: number
  criado_por?: string
}

export interface ReenviarCobrancaInput {
  pedido_id: string
  tenant_id: string
  userId: string
  telefone?: string
}

export interface BaixarItemDocumentoInput {
  pedido_id: string
  item_id: string
  documento_ged_id?: string
  tenant_id: string
  userId: string
}

export const TIPOS_DOCUMENTOS_FIXOS = [
  {
    tipo: 'extratos' as const,
    titulo: 'Extratos Bancários: (em PDF e OFX)',
    descricao: 'Extratos completos das contas correntes e aplicações da empresa no período.',
  },
  {
    tipo: 'cartoes' as const,
    titulo: 'Cartões de Crédito: Faturas completas do cartão da empresa',
    descricao: 'Faturas fechadas do cartão corporativo com detalhamento de lançamentos.',
  },
  {
    tipo: 'maquininhas' as const,
    titulo: 'Maquininhas e Apps: Relatórios de vendas e extratos de plataformas (ex: Mercado Pago)',
    descricao:
      'Relatórios consolidados de vendas em cartões, maquininhas (Cielo, Stone, etc.) e gateways.',
  },
  {
    tipo: 'credito' as const,
    titulo: 'Crédito: Contratos de novos empréstimos ou financiamentos',
    descricao:
      'Cédulas de crédito bancário, contratos de mútuo e financiamentos contratados na competência.',
  },
]

export const pedidosDocumentosService = {
  /**
   * Lista pedidos de documentos com filtros multi-tenant estritos
   */
  async listarPedidos(params: {
    tenantId: string
    empresaId?: string
    competencia?: string
    status?: string
  }): Promise<PedidoDocumentoRecord[]> {
    const filters = [`tenant_id = "${params.tenantId}"`]

    if (params.empresaId && params.empresaId !== 'todas') {
      filters.push(`empresa = "${params.empresaId}"`)
    }
    if (params.competencia && params.competencia !== 'todas') {
      filters.push(`competencia = "${params.competencia}"`)
    }
    if (params.status && params.status !== 'todos') {
      filters.push(`status = "${params.status}"`)
    }

    try {
      const records = await pb.collection('pedidos_documentos').getFullList<PedidoDocumentoRecord>({
        filter: filters.join(' && '),
        sort: '-created',
        expand: 'empresa,criado_por',
      })
      return records
    } catch (err) {
      console.error('[pedidosDocumentosService] Erro ao listar:', err)
      return []
    }
  },

  /**
   * Obtém pedido por ID ou pelo token público
   */
  async getPedido(idOrToken: string): Promise<PedidoDocumentoRecord | null> {
    try {
      if (idOrToken.length === 15) {
        // Provável record id
        try {
          return await pb
            .collection('pedidos_documentos')
            .getOne<PedidoDocumentoRecord>(idOrToken, {
              expand: 'empresa,criado_por',
            })
        } catch {
          /* intentionally ignored */
        }
      }
      return await pb
        .collection('pedidos_documentos')
        .getFirstListItem<PedidoDocumentoRecord>(`token_publico = "${idOrToken}"`, {
          expand: 'empresa,criado_por',
        })
    } catch (err) {
      console.warn('[pedidosDocumentosService] Pedido não encontrado:', idOrToken, err)
      return null
    }
  },

  /**
   * Cria novo pedido de documentos
   */
  async criarPedido(
    input: CriarPedidoDocumentoInput,
    userId: string,
  ): Promise<PedidoDocumentoRecord> {
    const token =
      'req_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(4)

    const dias = input.dias_expiracao || 15
    const linkExpiraEm = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString()

    const itensStatus: ItemStatusPedidoDocumento[] = input.itens.map((it, idx) => ({
      id: `it_${Date.now()}_${idx}`,
      tipo: it.tipo,
      detalhe: it.detalhe,
      status: 'solicitado',
      banco_conta_id: it.banco_conta_id,
      plataforma: it.plataforma,
    }))

    const record = await pb.collection('pedidos_documentos').create<PedidoDocumentoRecord>({
      tenant_id: input.tenant_id,
      empresa: input.empresa,
      competencia: input.competencia,
      token_publico: token,
      status: 'pendente',
      tipos_solicitados: input.tipos_solicitados,
      itens_status: itensStatus,
      link_expira_em: linkExpiraEm,
      criado_por: userId || null,
    })

    // Trilha de Auditoria
    await auditService.log(
      input.tenant_id,
      userId,
      'pedido_criado',
      'pedidos_documentos',
      record.id,
      JSON.stringify({
        empresa_id: input.empresa,
        competencia: input.competencia,
        tipos: input.tipos_solicitados,
        total_itens: itensStatus.length,
        token,
      }),
    )

    return record
  },

  /**
   * Envia ou cobra pedido via WhatsApp
   * Usa motor whatsapp_envios tipo 'documento' + endpoint /backend/v1/whatsapp-ativo/despachar-fila
   * Anti-flood: 24h com alerta ao operador
   */
  async enviarWhatsApp(input: {
    pedidoId: string
    tenantId: string
    userId: string
    telefoneDestinatario?: string
    isCobranca?: boolean
  }): Promise<{
    sucesso: boolean
    statusEnvio: string
    avisoFlood?: string
    mensagem: string
  }> {
    const pedido = await pb
      .collection('pedidos_documentos')
      .getOne<PedidoDocumentoRecord>(input.pedidoId, {
        expand: 'empresa',
      })

    const empresa = pedido.expand?.empresa
    if (!empresa) {
      throw new Error('Empresa vinculada ao pedido não foi encontrada.')
    }

    // 1. Verificar Anti-flood de 24h
    let avisoFlood: string | undefined
    if (pedido.ultimo_envio_whatsapp_em) {
      const diffMs = Date.now() - new Date(pedido.ultimo_envio_whatsapp_em).getTime()
      const diffHoras = diffMs / (1000 * 60 * 60)
      if (diffHoras < 24) {
        avisoFlood = `Atenção: Já houve disparo para este pedido há menos de 24h (${diffHoras.toFixed(1)}h atrás). O envio prosseguirá com registro de auditoria.`
      }
    }

    // 2. Destinatário e Mensagem
    const dest = (input.telefoneDestinatario || empresa.telefone || '').replace(/\D/g, '')
    if (!dest || dest.length < 10) {
      throw new Error(
        'Telefone do cliente inválido ou não cadastrado na empresa para envio via WhatsApp.',
      )
    }

    const host = window.location.origin
    const urlPedido = `${host}/portal-acessos?token=${pedido.token_publico}`

    const itensPendentes = (pedido.itens_status || []).filter((it) => it.status === 'solicitado')
    const listaItensTxt = itensPendentes.map((it) => `• ${it.detalhe}`).join('\n')

    let textoMsg = ''
    if (input.isCobranca) {
      textoMsg =
        `*LEMBRETE DE DOCUMENTOS PENDENTES - ${empresa.razao_social}*\n\n` +
        `Olá! Identificamos pendências no fechamento contábil da competência *${pedido.competencia}*.\n\n` +
        `*Itens aguardando envio:*\n${listaItensTxt}\n\n` +
        `Por favor, envie os arquivos diretamente através do nosso link seguro:\n👉 ${urlPedido}\n\n` +
        `Equipe Contábil Rumo.`
    } else {
      textoMsg =
        `*SOLICITAÇÃO DE DOCUMENTOS MENSAIS - ${empresa.razao_social}*\n\n` +
        `Olá! Para realizarmos o fechamento fiscal e contábil da competência *${pedido.competencia}*, solicitamos o envio dos documentos abaixo:\n\n` +
        `${listaItensTxt}\n\n` +
        `Envie seus arquivos de forma rápida e segura pelo link:\n👉 ${urlPedido}\n\n` +
        `Em caso de dúvidas, estamos à disposição!\nEquipe Contábil Rumo.`
    }

    // 3. Disparar via whatsappAtivoService
    const resp = await whatsappAtivoService.dispararEnvio({
      tenant_id: input.tenant_id,
      empresa_id: empresa.id,
      tipo: 'documento',
      referencia: `pedido_doc_${pedido.id}`,
      destinatario: dest,
      mensagem: textoMsg,
      origem: 'manual',
    })

    const agoraIso = new Date().toISOString()
    await pb.collection('pedidos_documentos').update(pedido.id, {
      ultimo_envio_whatsapp_em: agoraIso,
    })

    // 4. Trilha de auditoria
    await auditService.log(
      input.tenant_id,
      input.userId,
      input.isCobranca ? 'cobranca_reenviada' : 'pedido_enviado_whatsapp',
      'pedidos_documentos',
      pedido.id,
      JSON.stringify({
        empresa_id: empresa.id,
        destinatario: dest,
        status_envio: resp.status,
        itens_pendentes_count: itensPendentes.length,
      }),
    )

    return {
      sucesso: resp.sucesso,
      statusEnvio: resp.status,
      avisoFlood,
      mensagem: resp.mensagem,
    }
  },

  /**
   * Baixa manual de um item do pedido ("Marcar como recebido") vinculando a documento do GED
   */
  async marcarComoRecebido(input: BaixarItemDocumentoInput): Promise<PedidoDocumentoRecord> {
    const pedido = await pb
      .collection('pedidos_documentos')
      .getOne<PedidoDocumentoRecord>(input.pedido_id)

    const itens = (pedido.itens_status || []).map((it) => {
      if (it.id === input.item_id) {
        return {
          ...it,
          status: 'recebido' as const,
          documento_ged_id: input.documento_ged_id || it.documento_ged_id,
          recebido_em: new Date().toISOString(),
        }
      }
      return it
    })

    const totalItens = itens.length
    const recebidos = itens.filter((it) => it.status === 'recebido').length

    let novoStatus = pedido.status
    if (recebidos === totalItens && totalItens > 0) {
      novoStatus = 'atendido'
    } else if (recebidos > 0) {
      novoStatus = 'parcialmente_atendido'
    }

    const updated = await pb
      .collection('pedidos_documentos')
      .update<PedidoDocumentoRecord>(pedido.id, {
        itens_status: itens,
        status: novoStatus,
      })

    // Auditoria
    await auditService.log(
      input.tenant_id,
      input.userId,
      'documento_recebido',
      'pedidos_documentos',
      pedido.id,
      JSON.stringify({
        item_id: input.item_id,
        documento_ged_id: input.documento_ged_id,
        progresso: `${recebidos}/${totalItens}`,
        novo_status: novoStatus,
      }),
    )

    return updated
  },

  /**
   * Baixa automática quando documento é inserido no GED para a empresa e competência
   */
  async verificarBaixaAutomaticaGed(params: {
    tenantId: string
    empresaId: string
    competencia: string // MM/AAAA
    docId: string
    tipoDoc: string
  }): Promise<number> {
    try {
      const pedidos = await pb.collection('pedidos_documentos').getFullList<PedidoDocumentoRecord>({
        filter: `tenant_id = "${params.tenantId}" && empresa = "${params.empresaId}" && competencia = "${params.competencia}" && (status = "pendente" || status = "parcialmente_atendido")`,
      })

      let baixados = 0
      for (const ped of pedidos) {
        let mudou = false
        const itens = (ped.itens_status || []).map((it) => {
          if (it.status === 'solicitado') {
            // Mapeamento por tipo
            if (
              (it.tipo === 'extratos' && params.tipoDoc === 'extrato_bancario') ||
              (it.tipo === 'cartoes' && params.tipoDoc === 'outro') ||
              (it.tipo === 'maquininhas' && params.tipoDoc === 'outro') ||
              (it.tipo === 'credito' && params.tipoDoc === 'contrato')
            ) {
              mudou = true
              baixados++
              return {
                ...it,
                status: 'recebido' as const,
                documento_ged_id: params.docId,
                recebido_em: new Date().toISOString(),
              }
            }
          }
          return it
        })

        if (mudou) {
          const totalItens = itens.length
          const recCount = itens.filter((i) => i.status === 'recebido').length
          const st = recCount === totalItens ? 'atendido' : 'parcialmente_atendido'

          await pb.collection('pedidos_documentos').update(ped.id, {
            itens_status: itens,
            status: st,
          })

          await auditService.log(
            params.tenantId,
            pb.authStore.record?.id || '',
            'documento_recebido_ged_auto',
            'pedidos_documentos',
            ped.id,
            JSON.stringify({
              doc_id: params.docId,
              empresa_id: params.empresaId,
              competencia: params.competencia,
              progresso: `${recCount}/${totalItens}`,
            }),
          )
        }
      }

      return baixados
    } catch (err) {
      console.error('[pedidosDocumentosService] Erro na baixa automática GED:', err)
      return 0
    }
  },

  /**
   * Buscar documentos do GED da empresa para seletor de baixa manual
   */
  async listarDocumentosGed(tenantId: string, empresaId: string): Promise<Documento[]> {
    try {
      return await pb.collection('documentos').getFullList<Documento>({
        filter: `tenant_id = "${tenantId}" && empresa_id = "${empresaId}"`,
        sort: '-created',
      })
    } catch {
      return []
    }
  },

  /**
   * Buscar contas bancárias da empresa para popular checkboxes dinâmicos de extratos
   */
  async listarContasBancarias(tenantId: string, empresaId: string) {
    try {
      return await pb.collection('contas_bancarias').getFullList({
        filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && ativa = true`,
        sort: 'banco',
      })
    } catch {
      return []
    }
  },
}

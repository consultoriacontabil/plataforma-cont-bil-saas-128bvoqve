import pb from '@/lib/pocketbase/client'
import { auditService } from '@/services/audit'
import { notificacoesService } from '@/services/notificacoes'
import { whatsappAtivoService } from '@/services/whatsappAtivo'
import type {
  PedidoDocumentoRecord,
  ItemStatusPedidoDocumento,
  Documento,
  DocumentoTipo,
} from '@/types'

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
  observacoes?: string
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
  nome_arquivo?: string
  tenant_id: string
  userId?: string
}

export interface UploadArquivoPedidoPublicoInput {
  pedido: PedidoDocumentoRecord
  itemId: string
  file: File
  observacoes?: string
}

export const TIPOS_DOCUMENTOS_FIXOS = [
  {
    tipo: 'extratos' as const,
    categoriaGed: 'extrato_bancario' as DocumentoTipo,
    titulo: 'Extratos Bancários (PDF e OFX)',
    descricao: 'Extratos completos das contas correntes e aplicações da empresa no período.',
  },
  {
    tipo: 'cartoes' as const,
    categoriaGed: 'fatura_cartao' as DocumentoTipo,
    titulo: 'Faturas de Cartão de Crédito',
    descricao: 'Faturas completas do cartão corporativo com detalhamento de lançamentos.',
  },
  {
    tipo: 'maquininhas' as const,
    categoriaGed: 'maquininha' as DocumentoTipo,
    titulo: 'Maquininhas e Apps (Vendas e Extratos)',
    descricao:
      'Relatórios consolidados de vendas em cartões, maquininhas (Cielo, Stone, etc.) e plataformas (ex: Mercado Pago).',
  },
  {
    tipo: 'credito' as const,
    categoriaGed: 'credito' as DocumentoTipo,
    titulo: 'Crédito (Empréstimos ou Financiamentos)',
    descricao:
      'Contratos de novos empréstimos, cédulas de crédito bancário ou financiamentos da empresa.',
  },
]

export const pedidosDocumentosService = {
  /**
   * Mapeamento de tipo do pedido para categoria oficial do GED
   */
  mapearCategoriaGed(
    tipoPedido: 'extratos' | 'cartoes' | 'maquininhas' | 'credito',
  ): DocumentoTipo {
    switch (tipoPedido) {
      case 'extratos':
        return 'extrato_bancario'
      case 'cartoes':
        return 'fatura_cartao'
      case 'maquininhas':
        return 'maquininha'
      case 'credito':
        return 'credito'
      default:
        return 'outros'
    }
  },

  /**
   * Lista pedidos de documentos com filtros multi-tenant estritos
   */
  async listarPedidos(params: {
    tenantId: string
    empresaId?: string
    competencia?: string
    status?: string
    tipo?: string
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

      // Filtro em memória para tipo_solicitado se especificado
      if (params.tipo && params.tipo !== 'todos') {
        return records.filter(
          (r) =>
            Array.isArray(r.tipos_solicitados) &&
            r.tipos_solicitados.includes(params.tipo as string),
        )
      }

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
      observacoes: input.observacoes || '',
      criado_por: userId || null,
    })

    // Trilha de Auditoria
    await auditService.log(
      input.tenant_id,
      userId,
      'pedido_documento_criado',
      'pedidos_documentos',
      record.id,
      JSON.stringify({
        empresa_id: input.empresa,
        competencia: input.competencia,
        tipos: input.tipos_solicitados,
        total_itens: itensStatus.length,
        token,
        prazo_expiracao_dias: dias,
      }),
    )

    return record
  },

  /**
   * Envia ou cobra pedido via WhatsApp
   * Usa motor whatsapp_envios tipo 'documento' + endpoint /backend/v1/whatsapp-ativo/disparar
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
    const urlPedido = `${host}/pedidos-documentos/${pedido.token_publico}`

    const itensPendentes = (pedido.itens_status || []).filter((it) => it.status === 'solicitado')
    const listaItensTxt = itensPendentes.map((it) => `• ${it.detalhe}`).join('\n')

    let textoMsg = ''
    if (input.isCobranca) {
      textoMsg =
        `*LEMBRETE DE DOCUMENTOS PENDENTES - ${empresa.razao_social}*\n\n` +
        `Olá! Identificamos pendências no fechamento contábil da competência *${pedido.competencia}*.\n\n` +
        `*Itens aguardando envio:*\n${listaItensTxt}\n\n` +
        `Por favor, anexe os arquivos solicitados diretamente através do link seguro:\n👉 ${urlPedido}\n\n` +
        `Equipe Contábil Rumo.`
    } else {
      textoMsg =
        `*SOLICITAÇÃO DE DOCUMENTOS MENSAIS - ${empresa.razao_social}*\n\n` +
        `Olá! Para realizarmos o fechamento fiscal e contábil da competência *${pedido.competencia}*, solicitamos o envio dos documentos abaixo:\n\n` +
        `${listaItensTxt}\n\n` +
        `Envie seus arquivos de forma rápida e segura pelo link:\n👉 ${urlPedido}\n\n` +
        `Em caso de dúvidas, nossa equipe está à disposição!\nEquipe Contábil Rumo.`
    }

    // 3. Disparar via whatsappAtivoService
    const resp = await whatsappAtivoService.dispararEnvio({
      tenant_id: input.tenantId,
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
      input.tenantId,
      input.userId,
      input.isCobranca ? 'pedido_documento_lembrete_enviado' : 'pedido_documento_enviado_whatsapp',
      'pedidos_documentos',
      pedido.id,
      JSON.stringify({
        empresa_id: empresa.id,
        razao_social: empresa.razao_social,
        destinatario: dest,
        status_envio: resp.status,
        itens_pendentes_count: itensPendentes.length,
        is_cobranca: !!input.isCobranca,
      }),
    )

    return {
      sucesso: resp.sucesso,
      statusEnvio: resp.status,
      avisoFlood,
      mensagem: resp.mensagem || (resp.sucesso ? 'Enviado com sucesso' : 'Falha no envio'),
    }
  },

  /**
   * Upload de arquivo realizado pelo cliente através do Link Público.
   * Salva o documento no GED na categoria correspondente, atualiza o item do pedido,
   * altera status para 'atendido' se todos chegarem, notifica o contador e audita.
   */
  async uploadArquivoClientePublico(
    input: UploadArquivoPedidoPublicoInput,
  ): Promise<{ pedido: PedidoDocumentoRecord; documentoId: string }> {
    const { pedido, itemId, file, observacoes } = input

    // 1. Localizar item no pedido
    const item = (pedido.itens_status || []).find((i) => i.id === itemId)
    if (!item) {
      throw new Error('Item solicitado não foi encontrado neste pedido.')
    }

    // 2. Determinar categoria correta do GED
    const categoriaGed = this.mapearCategoriaGed(item.tipo)

    // 3. Criar registro no GED (documentos) com origem_documento = 'link_publico'
    const formData = new FormData()
    formData.append('tenant_id', pedido.tenant_id)
    formData.append('empresa_id', pedido.empresa)
    formData.append('nome_arquivo', file.name)
    formData.append('tipo', categoriaGed)
    formData.append('status', 'processado')
    formData.append('origem_documento', 'link_publico')
    formData.append(
      'observacoes',
      observacoes ||
        `Enviado pelo cliente via Portal de Pedidos (Comp. ${pedido.competencia}) - Item: ${item.detalhe}`,
    )
    formData.append('arquivo', file)

    const docGed = await pb.collection('documentos').create<Documento>(formData)

    // 4. Atualizar itens_status do pedido
    const agoraIso = new Date().toISOString()
    const novosItens = (pedido.itens_status || []).map((it) => {
      if (it.id === itemId) {
        return {
          ...it,
          status: 'recebido' as const,
          documento_ged_id: docGed.id,
          nome_arquivo: file.name,
          recebido_em: agoraIso,
        }
      }
      return it
    })

    const totalItens = novosItens.length
    const recebidos = novosItens.filter((it) => it.status === 'recebido').length

    let novoStatus: 'pendente' | 'parcialmente_atendido' | 'atendido' = 'pendente'
    if (recebidos === totalItens && totalItens > 0) {
      novoStatus = 'atendido'
    } else if (recebidos > 0) {
      novoStatus = 'parcialmente_atendido'
    }

    const pedidoAtualizado = await pb
      .collection('pedidos_documentos')
      .update<PedidoDocumentoRecord>(
        pedido.id,
        {
          itens_status: novosItens,
          status: novoStatus,
        },
        { expand: 'empresa,criado_por' },
      )

    // 5. Trilha de auditoria
    try {
      await auditService.log(
        pedido.tenant_id,
        '', // cliente anônimo via link público
        'documento_cliente_enviado_publico',
        'pedidos_documentos',
        pedido.id,
        JSON.stringify({
          item_id: itemId,
          tipo_item: item.tipo,
          categoria_ged: categoriaGed,
          nome_arquivo: file.name,
          tamanho_bytes: file.size,
          documento_ged_id: docGed.id,
          progresso: `${recebidos}/${totalItens}`,
          novo_status_pedido: novoStatus,
        }),
      )
    } catch (errAudit) {
      console.warn('Erro ao registrar audit_log do upload público:', errAudit)
    }

    // 6. Notificação interna ao contador responsável
    try {
      const empRazao = pedido.expand?.empresa?.razao_social || 'Empresa'
      const msgNotif =
        novoStatus === 'atendido'
          ? `Todos os documentos solicitados da empresa ${empRazao} (Comp. ${pedido.competencia}) foram recebidos no GED!`
          : `Novo documento anexado para ${empRazao}: "${file.name}" (${item.detalhe}). Progresso: ${recebidos}/${totalItens}.`

      await notificacoesService.criarNotificacao({
        tenant_id: pedido.tenant_id,
        usuario_destino_id: pedido.criado_por || undefined,
        titulo:
          novoStatus === 'atendido'
            ? 'Pedido de documentos concluído 100%'
            : 'Documento recebido via Link Público',
        mensagem: msgNotif,
        tipo: 'sistema',
        link: '/portal-acessos',
      })
    } catch (errNotif) {
      console.warn('Erro ao disparar notificação interna:', errNotif)
    }

    return { pedido: pedidoAtualizado, documentoId: docGed.id }
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
          nome_arquivo: input.nome_arquivo || it.nome_arquivo,
          recebido_em: new Date().toISOString(),
        }
      }
      return it
    })

    const totalItens = itens.length
    const recebidos = itens.filter((it) => it.status === 'recebido').length

    let novoStatus: 'pendente' | 'parcialmente_atendido' | 'atendido' = 'pendente'
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
      input.userId || '',
      'documento_recebido_manual',
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
   * Cancelar ou excluir pedido de documentos
   */
  async cancelarPedido(
    pedidoId: string,
    tenantId: string,
    userId: string,
    motivo?: string,
  ): Promise<PedidoDocumentoRecord> {
    const updated = await pb
      .collection('pedidos_documentos')
      .update<PedidoDocumentoRecord>(pedidoId, {
        status: 'cancelado',
      })

    await auditService.log(
      tenantId,
      userId,
      'pedido_documento_cancelado',
      'pedidos_documentos',
      pedidoId,
      JSON.stringify({ motivo: motivo || 'Cancelado pelo operador contábil' }),
    )

    return updated
  },

  async excluirPedido(pedidoId: string, tenantId: string, userId: string): Promise<boolean> {
    await auditService.log(
      tenantId,
      userId,
      'pedido_documento_excluido',
      'pedidos_documentos',
      pedidoId,
      JSON.stringify({ acao: 'exclusao_definitiva' }),
    )

    return pb.collection('pedidos_documentos').delete(pedidoId)
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
              (it.tipo === 'cartoes' && params.tipoDoc === 'fatura_cartao') ||
              (it.tipo === 'maquininhas' && params.tipoDoc === 'maquininha') ||
              (it.tipo === 'credito' && params.tipoDoc === 'credito')
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

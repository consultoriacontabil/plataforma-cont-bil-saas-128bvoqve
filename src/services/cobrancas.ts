import { pb } from '@/lib/pocketbase/client'
import { CobrancaRecord, CobrancaStatus, CobrancaTipo, Empresa } from '@/types'
import { auditService } from './audit'
import { whatsappAtivoService } from './whatsappAtivo'
import { gerarPayloadPixEmv } from '@/lib/pixEmv'

export interface CreateCobrancaInput {
  tenant_id: string
  empresa: string
  tipo: CobrancaTipo
  descricao: string
  competencia?: string
  valor: number
  vencimento: string
  chave_pix?: string
  beneficiario_nome?: string
  codigo_barras?: string
  link_boleto?: string
  observacoes?: string
}

export interface ListCobrancasFilters {
  empresaId?: string
  status?: CobrancaStatus
  tipo?: CobrancaTipo
  competencia?: string
}

export const cobrancasService = {
  /**
   * Listar cobranças do tenant atual com filtros opcionais
   */
  async list(filters?: ListCobrancasFilters): Promise<CobrancaRecord[]> {
    const authData = pb.authStore.record
    const tenantId = authData?.tenant_id
    if (!tenantId) return []

    const filterParts: string[] = [`tenant_id = "${tenantId}"`]

    if (filters?.empresaId && filters.empresaId !== 'todas') {
      filterParts.push(`empresa = "${filters.empresaId}"`)
    }
    if (filters?.status) {
      filterParts.push(`status = "${filters.status}"`)
    }
    if (filters?.tipo) {
      filterParts.push(`tipo = "${filters.tipo}"`)
    }
    if (filters?.competencia) {
      filterParts.push(`competencia = "${filters.competencia}"`)
    }

    try {
      return await pb.collection('cobrancas').getFullList<CobrancaRecord>({
        filter: filterParts.join(' && '),
        sort: '-vencimento,-created',
        expand: 'empresa,whatsapp_envio_id',
      })
    } catch (err) {
      console.error('Erro ao listar cobranças:', err)
      return []
    }
  },

  /**
   * Buscar cobrança por ID
   */
  async getById(id: string): Promise<CobrancaRecord | null> {
    try {
      return await pb.collection('cobrancas').getOne<CobrancaRecord>(id, {
        expand: 'empresa,whatsapp_envio_id',
      })
    } catch (err) {
      console.error('Erro ao buscar cobrança por id:', err)
      return null
    }
  },

  /**
   * Criar uma nova cobrança gerando automaticamente o payload EMV BR Code PIX estático
   */
  async create(input: CreateCobrancaInput): Promise<CobrancaRecord> {
    let payloadPix = ''

    if (input.tipo === 'pix' && input.chave_pix) {
      payloadPix = gerarPayloadPixEmv({
        chavePix: input.chave_pix,
        nomeRecebedor: input.beneficiario_nome || 'RUMO CONTABIL',
        valor: input.valor,
        descricao: input.descricao.slice(0, 30),
      })
    }

    const rec = await pb.collection('cobrancas').create<CobrancaRecord>({
      tenant_id: input.tenant_id,
      empresa: input.empresa,
      tipo: input.tipo,
      descricao: input.descricao,
      competencia: input.competencia || '',
      valor: input.valor,
      vencimento: input.vencimento,
      status: 'pendente',
      chave_pix: input.chave_pix || '',
      beneficiario_nome: input.beneficiario_nome || '',
      codigo_barras: input.codigo_barras || '',
      payload_pix: payloadPix,
      link_boleto: input.link_boleto || '',
      observacoes: input.observacoes || '',
    })

    await auditService.log({
      tenant_id: input.tenant_id,
      action: 'cobranca_criada',
      entidade: 'cobrancas',
      registro_id: rec.id,
      dados_novos: {
        tipo: input.tipo,
        valor: input.valor,
        vencimento: input.vencimento,
        empresa: input.empresa,
      },
    })

    return rec
  },

  /**
   * Atualizar dados de uma cobrança
   */
  async update(id: string, dados: Partial<CobrancaRecord>): Promise<CobrancaRecord> {
    const atual = await this.getById(id)
    if (!atual) throw new Error('Cobrança não encontrada')

    const valor = dados.valor ?? atual.valor
    const chave = dados.chave_pix ?? atual.chave_pix
    const tipo = dados.tipo ?? atual.tipo
    const beneficiario = dados.beneficiario_nome ?? atual.beneficiario_nome
    const desc = dados.descricao ?? atual.descricao

    let payloadPix = dados.payload_pix ?? atual.payload_pix
    if (tipo === 'pix' && chave) {
      payloadPix = gerarPayloadPixEmv({
        chavePix: chave,
        nomeRecebedor: beneficiario || 'RUMO CONTABIL',
        valor,
        descricao: desc.slice(0, 30),
      })
    }

    const updated = await pb.collection('cobrancas').update<CobrancaRecord>(id, {
      ...dados,
      payload_pix: payloadPix,
    })

    await auditService.log({
      tenant_id: atual.tenant_id,
      action: 'cobranca_atualizada',
      entidade: 'cobrancas',
      registro_id: id,
      dados_anteriores: { status: atual.status, valor: atual.valor },
      dados_novos: dados,
    })

    return updated
  },

  /**
   * Baixa da cobrança ("Marcar como Pago")
   */
  async marcarComoPago(params: {
    id: string
    pago_em?: string
    pago_valor?: number
  }): Promise<CobrancaRecord> {
    const cob = await this.getById(params.id)
    if (!cob) throw new Error('Cobrança não encontrada')

    const dataPagamento = params.pago_em || new Date().toISOString()
    const valorPago = params.pago_valor ?? cob.valor

    const updated = await pb.collection('cobrancas').update<CobrancaRecord>(params.id, {
      status: 'pago',
      pago_em: dataPagamento,
      pago_valor: valorPago,
    })

    await auditService.log({
      tenant_id: cob.tenant_id,
      action: 'cobranca_baixada_paga',
      entidade: 'cobrancas',
      registro_id: params.id,
      dados_anteriores: { status: cob.status },
      dados_novos: { status: 'pago', pago_em: dataPagamento, pago_valor: valorPago },
    })

    return updated
  },

  /**
   * Cancelar uma cobrança
   */
  async cancelar(id: string, motivo?: string): Promise<CobrancaRecord> {
    const cob = await this.getById(id)
    if (!cob) throw new Error('Cobrança não encontrada')

    const updated = await pb.collection('cobrancas').update<CobrancaRecord>(id, {
      status: 'cancelado',
      observacoes: motivo
        ? `${cob.observacoes || ''}\nCancelado: ${motivo}`.trim()
        : cob.observacoes,
    })

    await auditService.log({
      tenant_id: cob.tenant_id,
      action: 'cobranca_cancelada',
      entidade: 'cobrancas',
      registro_id: id,
      dados_anteriores: { status: cob.status },
      dados_novos: { status: 'cancelado', motivo },
    })

    return updated
  },

  /**
   * Disparar aviso da cobrança por WhatsApp usando o motor de disparo existente
   */
  async enviarPorWhatsApp(params: {
    cobranca: CobrancaRecord
    empresa: Empresa
    telefone?: string
    origem?: 'manual' | 'elliza' | 'agendador'
  }): Promise<{ sucesso: boolean; status: string; mensagem: string; envio_id?: string }> {
    const { cobranca, empresa } = params

    // 1. Obter autorização de envio da empresa
    const autoriz = await whatsappAtivoService.getAutorizacaoEmpresa(empresa.id)
    if (autoriz && !autoriz.ativo) {
      throw new Error(
        `O canal de WhatsApp para ${empresa.razao_social} está desativado nas preferências.`,
      )
    }
    if (autoriz && autoriz.permitir_cobrancas === false) {
      throw new Error(
        `A empresa ${empresa.razao_social} não autorizou envio de cobranças por WhatsApp. Ative a permissão nas preferências da empresa.`,
      )
    }

    const destino = params.telefone || autoriz?.telefone_destinatario || empresa.telefone || ''
    if (!destino) {
      throw new Error(
        `Nenhum telefone de WhatsApp configurado para a empresa ${empresa.razao_social}.`,
      )
    }

    // 2. Gerar mensagem padronizada de cobrança
    const mensagem = whatsappAtivoService.gerarTemplateCobranca({
      empresa,
      descricao: cobranca.descricao,
      competencia: cobranca.competencia,
      valor: cobranca.valor,
      vencimento: cobranca.vencimento,
      chavePix: cobranca.chave_pix,
      payloadPix: cobranca.payload_pix,
      codigoBarras: cobranca.codigo_barras,
      beneficiarioNome: cobranca.beneficiario_nome,
      linkBoleto: cobranca.link_boleto,
    })

    // 3. Chamar backend /backend/v1/whatsapp-ativo/disparar
    const resp = await whatsappAtivoService.dispararEnvio({
      tenant_id: cobranca.tenant_id,
      empresa_id: empresa.id,
      tipo: 'cobranca',
      referencia: `cobranca_${cobranca.id}`,
      destinatario: destino,
      mensagem,
      origem: params.origem || 'manual',
    })

    // 4. Vincular whatsapp_envio_id na cobrança
    if (resp.envio_id) {
      await pb.collection('cobrancas').update(cobranca.id, {
        whatsapp_envio_id: resp.envio_id,
      })
    }

    return resp
  },
}

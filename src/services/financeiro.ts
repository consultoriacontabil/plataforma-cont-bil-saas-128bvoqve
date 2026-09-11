import pb from '@/lib/pocketbase/client'
import type {
  ContaBancariaRecord,
  ContaFinanceiraRecord,
  ExtratoBancarioRecord,
  ContaFinanceiraTipo,
  ContaFinanceiraStatus,
} from '@/types'
import { contabilService } from '@/services/contabil'

export interface CreateContaBancariaInput {
  tenant_id: string
  empresa: string
  banco: string
  agencia: string
  conta: string
  saldo_inicial: number
  saldo_atual?: number
  ativa: boolean
  conta_contabil?: string
}

export interface CreateContaFinanceiraInput {
  tenant_id: string
  empresa: string
  tipo: ContaFinanceiraTipo
  pessoa: string
  descricao: string
  documento_ref?: string
  categoria?: string
  valor: number
  data_emissao: string
  data_vencimento: string
  data_pagamento?: string
  status: ContaFinanceiraStatus
  conta_bancaria?: string
  observacoes?: string
}

export interface BaixaTituloInput {
  tituloId: string
  dataPagamento: string
  contaBancariaId?: string
  gerarLancamentoContabil?: boolean
  usuarioId?: string
}

export interface ImportExtratoItem {
  data: string
  descricao: string
  documento_numero?: string
  valor: number
  tipo_transacao: 'credito' | 'debito'
}

export const financeiroService = {
  // === Contas Bancárias ===
  async listContasBancarias(tenantId: string, empresaId?: string): Promise<ContaBancariaRecord[]> {
    let filter = `tenant_id = "${tenantId}"`
    if (empresaId && empresaId !== 'all') {
      filter += ` && empresa = "${empresaId}"`
    }
    return pb.collection('contas_bancarias').getFullList<ContaBancariaRecord>({
      filter,
      sort: '-created',
      expand: 'empresa,conta_contabil',
    })
  },

  async createContaBancaria(data: CreateContaBancariaInput): Promise<ContaBancariaRecord> {
    const payload = {
      ...data,
      saldo_atual: data.saldo_atual !== undefined ? data.saldo_atual : data.saldo_inicial,
    }
    return pb.collection('contas_bancarias').create<ContaBancariaRecord>(payload)
  },

  async updateContaBancaria(
    id: string,
    data: Partial<CreateContaBancariaInput>,
  ): Promise<ContaBancariaRecord> {
    return pb.collection('contas_bancarias').update<ContaBancariaRecord>(id, data)
  },

  async deleteContaBancaria(id: string): Promise<boolean> {
    return pb.collection('contas_bancarias').delete(id)
  },

  // === Contas Financeiras (Pagar / Receber) ===
  async listTitulos(
    tenantId: string,
    filtros?: {
      empresaId?: string
      tipo?: ContaFinanceiraTipo
      status?: ContaFinanceiraStatus | 'todos'
      periodoInicio?: string
      periodoFim?: string
      busca?: string
    },
  ): Promise<ContaFinanceiraRecord[]> {
    let filter = `tenant_id = "${tenantId}"`
    if (filtros?.empresaId && filtros.empresaId !== 'all') {
      filter += ` && empresa = "${filtros.empresaId}"`
    }
    if (filtros?.tipo) {
      filter += ` && tipo = "${filtros.tipo}"`
    }
    if (filtros?.status && filtros.status !== 'todos') {
      filter += ` && status = "${filtros.status}"`
    }
    if (filtros?.periodoInicio) {
      filter += ` && data_vencimento >= "${filtros.periodoInicio}"`
    }
    if (filtros?.periodoFim) {
      filter += ` && data_vencimento <= "${filtros.periodoFim} 23:59:59"`
    }
    if (filtros?.busca) {
      const q = filtros.busca.replace(/"/g, '')
      filter += ` && (pessoa ~ "${q}" || descricao ~ "${q}" || documento_ref ~ "${q}")`
    }

    return pb.collection('contas_financeiras').getFullList<ContaFinanceiraRecord>({
      filter,
      sort: 'data_vencimento',
      expand: 'empresa,categoria,conta_bancaria',
    })
  },

  async createTitulo(data: CreateContaFinanceiraInput): Promise<ContaFinanceiraRecord> {
    return pb.collection('contas_financeiras').create<ContaFinanceiraRecord>(data)
  },

  async updateTitulo(
    id: string,
    data: Partial<CreateContaFinanceiraInput>,
  ): Promise<ContaFinanceiraRecord> {
    return pb.collection('contas_financeiras').update<ContaFinanceiraRecord>(id, data)
  },

  async deleteTitulo(id: string): Promise<boolean> {
    return pb.collection('contas_financeiras').delete(id)
  },

  // Baixa de título (com opção de lançamento contábil em partidas dobradas)
  async baixarTitulo(input: BaixaTituloInput): Promise<ContaFinanceiraRecord> {
    const titulo = await pb
      .collection('contas_financeiras')
      .getOne<ContaFinanceiraRecord>(input.tituloId, { expand: 'empresa,categoria,conta_bancaria' })

    let loteId: string | undefined = undefined

    // Se solicitado gerar lançamento contábil e tiver os vínculos
    if (input.gerarLancamentoContabil) {
      try {
        let contaBancoContabilId = ''
        if (input.contaBancariaId) {
          const cb = await pb
            .collection('contas_bancarias')
            .getOne<ContaBancariaRecord>(input.contaBancariaId)
          if (cb.conta_contabil) {
            contaBancoContabilId = cb.conta_contabil
          }
        }

        // Se a conta bancária não tiver conta contábil explícita, buscar conta "1.1.1.02" (Bancos Movimento)
        if (!contaBancoContabilId) {
          const bancosPadrao = await pb.collection('plano_contas').getFullList({
            filter: `tenant_id = "${titulo.tenant_id}" && codigo = "1.1.1.02"`,
            limit: 1,
          })
          if (bancosPadrao.length > 0) {
            contaBancoContabilId = bancosPadrao[0].id
          }
        }

        const categoriaContabilId = titulo.categoria
        if (contaBancoContabilId && categoriaContabilId) {
          // Extrair competência MM/YYYY da data de pagamento
          const dt = new Date(input.dataPagamento)
          const compMonth = String(dt.getUTCMonth() + 1).padStart(2, '0')
          const compYear = dt.getUTCFullYear()
          const competencia = `${compMonth}/${compYear}`

          loteId = `FIN-BAIXA-${titulo.id.slice(0, 8)}-${Date.now()}`

          // Partida Dobrada:
          // Se pagar: Débito em Categoria/Fornecedor, Crédito em Bancos Conta Movimento
          // Se receber: Débito em Bancos Conta Movimento, Crédito em Categoria/Clientes
          const debitoId = titulo.tipo === 'pagar' ? categoriaContabilId : contaBancoContabilId
          const creditoId = titulo.tipo === 'pagar' ? contaBancoContabilId : categoriaContabilId

          await contabilService.createPartidaDobrada({
            tenant_id: titulo.tenant_id,
            empresa: titulo.empresa,
            data: input.dataPagamento,
            competencia,
            valor: titulo.valor,
            historico: `Baixa de ${titulo.tipo === 'pagar' ? 'pagamento' : 'recebimento'} ref. ${titulo.descricao} (${titulo.pessoa})`,
            debitoContaId: debitoId,
            creditoContaId: creditoId,
            status: 'confirmado',
            criado_por: input.usuarioId,
          })
        }
      } catch (contabilErr) {
        console.warn('Erro ao gerar lançamento contábil na baixa:', contabilErr)
        // Se a competência estiver fechada, o hook lançará BadRequestError que é propagado
        throw contabilErr
      }
    }

    const updatePayload: Record<string, unknown> = {
      status: 'pago',
      data_pagamento: input.dataPagamento,
    }
    if (input.contaBancariaId) {
      updatePayload.conta_bancaria = input.contaBancariaId
    }
    if (loteId) {
      updatePayload.lote_contabil_id = loteId
    }

    return pb
      .collection('contas_financeiras')
      .update<ContaFinanceiraRecord>(titulo.id, updatePayload)
  },

  // === Extratos Bancários & Conciliação ===
  async listExtratos(
    tenantId: string,
    contaBancariaId?: string,
    empresaId?: string,
  ): Promise<ExtratoBancarioRecord[]> {
    let filter = `tenant_id = "${tenantId}"`
    if (contaBancariaId && contaBancariaId !== 'all') {
      filter += ` && conta_bancaria = "${contaBancariaId}"`
    }
    if (empresaId && empresaId !== 'all') {
      filter += ` && empresa = "${empresaId}"`
    }

    return pb.collection('extratos_bancarios').getFullList<ExtratoBancarioRecord>({
      filter,
      sort: '-data',
      expand: 'conta_bancaria,empresa,titulo_conciliado',
    })
  },

  async importExtratoLote(
    tenantId: string,
    empresaId: string,
    contaBancariaId: string,
    itens: ImportExtratoItem[],
  ): Promise<number> {
    let inseridos = 0
    for (const item of itens) {
      try {
        await pb.collection('extratos_bancarios').create({
          tenant_id: tenantId,
          empresa: empresaId,
          conta_bancaria: contaBancariaId,
          data: item.data,
          descricao: item.descricao,
          documento_numero: item.documento_numero || '',
          valor: item.valor,
          tipo_transacao: item.tipo_transacao,
          status: 'pendente',
        })
        inseridos++
      } catch (err) {
        console.error('Erro importando linha do extrato:', err)
      }
    }
    return inseridos
  },

  // Conciliar linha de extrato com título financeiro (ou avulso)
  async conciliarExtrato(
    extratoId: string,
    tituloId?: string,
    opcoes?: {
      gerarLancamentoContabil?: boolean
      categoriaId?: string
      usuarioId?: string
    },
  ): Promise<ExtratoBancarioRecord> {
    const extrato = await pb
      .collection('extratos_bancarios')
      .getOne<ExtratoBancarioRecord>(extratoId, { expand: 'conta_bancaria' })

    let loteId: string | undefined = undefined

    // Se estiver associando a um título existente
    if (tituloId) {
      const titulo = await pb
        .collection('contas_financeiras')
        .getOne<ContaFinanceiraRecord>(tituloId)

      // Atualizar o título para pago se ainda estiver pendente
      if (titulo.status !== 'pago') {
        await pb.collection('contas_financeiras').update(titulo.id, {
          status: 'pago',
          data_pagamento: extrato.data,
          conta_bancaria: extrato.conta_bancaria,
        })
      }

      // Se solicitado lançamento contábil
      if (opcoes?.gerarLancamentoContabil) {
        let contaBancoContabilId = ''
        if (extrato.expand?.conta_bancaria?.conta_contabil) {
          contaBancoContabilId = extrato.expand.conta_bancaria.conta_contabil
        } else {
          const bancosPadrao = await pb.collection('plano_contas').getFullList({
            filter: `tenant_id = "${extrato.tenant_id}" && codigo = "1.1.1.02"`,
            limit: 1,
          })
          if (bancosPadrao.length > 0) contaBancoContabilId = bancosPadrao[0].id
        }

        const categoriaContabilId = titulo.categoria || opcoes.categoriaId
        if (contaBancoContabilId && categoriaContabilId) {
          const dt = new Date(extrato.data)
          const compMonth = String(dt.getUTCMonth() + 1).padStart(2, '0')
          const compYear = dt.getUTCFullYear()
          const competencia = `${compMonth}/${compYear}`

          loteId = `CONCIL-${extrato.id.slice(0, 8)}-${Date.now()}`
          const isDebitoBanco = extrato.tipo_transacao === 'debito'

          const debitoId = isDebitoBanco ? categoriaContabilId : contaBancoContabilId
          const creditoId = isDebitoBanco ? contaBancoContabilId : categoriaContabilId

          await contabilService.createPartidaDobrada({
            tenant_id: extrato.tenant_id,
            empresa: extrato.empresa,
            data: extrato.data,
            competencia,
            valor: Math.abs(extrato.valor),
            historico: `Conciliação bancária: ${extrato.descricao} (${titulo.descricao})`,
            debitoContaId: debitoId,
            creditoContaId: creditoId,
            status: 'confirmado',
            criado_por: opcoes?.usuarioId,
          })
        }
      }
    } else if (opcoes?.gerarLancamentoContabil && opcoes?.categoriaId) {
      // Conciliação direta sem título prévio (ex: tarifa bancária ou rendimento)
      let contaBancoContabilId = ''
      if (extrato.expand?.conta_bancaria?.conta_contabil) {
        contaBancoContabilId = extrato.expand.conta_bancaria.conta_contabil
      } else {
        const bancosPadrao = await pb.collection('plano_contas').getFullList({
          filter: `tenant_id = "${extrato.tenant_id}" && codigo = "1.1.1.02"`,
          limit: 1,
        })
        if (bancosPadrao.length > 0) contaBancoContabilId = bancosPadrao[0].id
      }

      const dt = new Date(extrato.data)
      const compMonth = String(dt.getUTCMonth() + 1).padStart(2, '0')
      const compYear = dt.getUTCFullYear()
      const competencia = `${compMonth}/${compYear}`

      loteId = `CONCIL-AVULSO-${extrato.id.slice(0, 8)}-${Date.now()}`
      const isDebitoBanco = extrato.tipo_transacao === 'debito'
      const debitoId = isDebitoBanco ? opcoes.categoriaId : contaBancoContabilId
      const creditoId = isDebitoBanco ? contaBancoContabilId : opcoes.categoriaId

      await contabilService.createPartidaDobrada({
        tenant_id: extrato.tenant_id,
        empresa: extrato.empresa,
        data: extrato.data,
        competencia,
        valor: Math.abs(extrato.valor),
        historico: `Conciliação extrato avulso: ${extrato.descricao}`,
        debitoContaId: debitoId,
        creditoContaId: creditoId,
        status: 'confirmado',
        criado_por: opcoes?.usuarioId,
      })
    }

    const payload: Record<string, unknown> = {
      status: 'conciliado',
      conciliado_em: new Date().toISOString(),
      conciliado_por: opcoes?.usuarioId,
    }
    if (tituloId) payload.titulo_conciliado = tituloId
    if (loteId) payload.lote_contabil_id = loteId

    return pb.collection('extratos_bancarios').update<ExtratoBancarioRecord>(extrato.id, payload)
  },

  async desconciliarExtrato(extratoId: string): Promise<ExtratoBancarioRecord> {
    return pb.collection('extratos_bancarios').update<ExtratoBancarioRecord>(extratoId, {
      status: 'pendente',
      titulo_conciliado: null,
      conciliado_em: null,
      conciliado_por: null,
    })
  },
}

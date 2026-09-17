import pb from '@/lib/pocketbase/client'
import type {
  ContaBancariaRecord,
  ContaFinanceiraRecord,
  ExtratoBancarioRecord,
  ContaFinanceiraTipo,
  ContaFinanceiraStatus,
  IntegracaoBancariaRecord,
  IntegracaoLogRecord,
  IntegracaoModo,
  IntegracaoFrequencia,
  IntegracaoFonteTipo,
  IntegracaoStatus,
  DFCFluxoResultado,
  FluxoCaixaCompetenciaResumo,
  FluxoCaixaItemProjecao,
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
    _tenantId?: string,
  ): Promise<ContaFinanceiraRecord> {
    return pb.collection('contas_financeiras').update<ContaFinanceiraRecord>(id, data)
  },

  async deleteTitulo(id: string, _tenantId?: string): Promise<boolean> {
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
    options?: {
      autoMatch?: boolean
      usuarioId?: string
      integracaoId?: string
    },
  ): Promise<{ inseridos: number; duplicados: number; conciliados: number }> {
    let inseridos = 0
    let duplicados = 0
    let conciliados = 0

    // Buscar extratos existentes da conta para verificação anti-duplicidade (mesma data, valor e descrição similar)
    const existentes = await pb
      .collection('extratos_bancarios')
      .getFullList<ExtratoBancarioRecord>({
        filter: `tenant_id = "${tenantId}" && conta_bancaria = "${contaBancariaId}"`,
      })

    // Buscar títulos em aberto ou pendentes para auto-match caso solicitado
    let titulosAbertos: ContaFinanceiraRecord[] = []
    if (options?.autoMatch) {
      titulosAbertos = await pb
        .collection('contas_financeiras')
        .getFullList<ContaFinanceiraRecord>({
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && status != "cancelado"`,
        })
    }

    for (const item of itens) {
      try {
        const itemDateStr = item.data.split('T')[0]
        const isDuplicado = existentes.some((ex) => {
          const exDateStr = ex.data.split('T')[0]
          const mesmoValor = Math.abs(ex.valor - item.valor) < 0.01
          const mesmaDesc =
            ex.descricao.trim().toLowerCase() === item.descricao.trim().toLowerCase() ||
            (ex.documento_numero &&
              item.documento_numero &&
              ex.documento_numero === item.documento_numero)
          return exDateStr === itemDateStr && mesmoValor && mesmaDesc
        })

        if (isDuplicado) {
          duplicados++
          continue
        }

        let tituloMatchId: string | undefined = undefined
        if (options?.autoMatch) {
          const valorAbs = Math.abs(item.valor)
          const match = titulosAbertos.find((t) => {
            const matchTipo =
              item.tipo_transacao === 'debito' ? t.tipo === 'pagar' : t.tipo === 'receber'
            const matchValor = Math.abs(t.valor - valorAbs) < 0.05
            const tDateStr = t.data_vencimento.split('T')[0]
            // Dentro de uma tolerância de 5 dias do vencimento
            const diffDias = Math.abs(
              (new Date(itemDateStr).getTime() - new Date(tDateStr).getTime()) /
                (1000 * 60 * 60 * 24),
            )
            return matchTipo && matchValor && diffDias <= 5 && t.status !== 'pago'
          })

          if (match) {
            tituloMatchId = match.id
            // Atualizar status do título para pago
            try {
              await pb.collection('contas_financeiras').update(match.id, {
                status: 'pago',
                data_pagamento: item.data,
                conta_bancaria: contaBancariaId,
              })
              conciliados++
            } catch {
              /* intentionally ignored */
            }
          }
        }

        const extratoCriado = await pb
          .collection('extratos_bancarios')
          .create<ExtratoBancarioRecord>({
            tenant_id: tenantId,
            empresa: empresaId,
            conta_bancaria: contaBancariaId,
            data: item.data,
            descricao: item.descricao,
            documento_numero: item.documento_numero || '',
            valor: item.valor,
            tipo_transacao: item.tipo_transacao,
            status: tituloMatchId ? 'conciliado' : 'pendente',
            titulo_conciliado: tituloMatchId || null,
            conciliado_em: tituloMatchId ? new Date().toISOString() : null,
            conciliado_por: tituloMatchId ? options?.usuarioId : null,
          })

        existentes.push(extratoCriado)
        inseridos++
      } catch (err) {
        console.error('Erro importando linha do extrato:', err)
      }
    }

    // Se houver integracaoId, registrar log e incrementar contadores
    if (options?.integracaoId) {
      try {
        const intRec = await pb.collection('integracoes_bancarias').getOne(options.integracaoId)
        const novoTotImp = (intRec.total_importados || 0) + inseridos
        const novoTotConc = (intRec.total_conciliados || 0) + conciliados

        await pb.collection('integracoes_bancarias').update(options.integracaoId, {
          ultima_execucao: new Date().toISOString(),
          total_importados: novoTotImp,
          total_conciliados: novoTotConc,
        })

        await pb.collection('integracoes_logs').create({
          tenant_id: tenantId,
          integracao: options.integracaoId,
          conta_bancaria: contaBancariaId,
          data_execucao: new Date().toISOString(),
          status: 'sucesso',
          linhas_lidas: itens.length,
          linhas_importadas: inseridos,
          linhas_duplicadas: duplicados,
          linhas_conciliadas: conciliados,
          mensagem: `Execução manual/sob demanda: ${inseridos} importadas, ${duplicados} duplicadas ignoradas, ${conciliados} conciliadas automaticamente.`,
          detalhes_json: {
            modo: 'manual_trigger',
            linhas_totais: itens.length,
          },
        })
      } catch (logErr) {
        console.warn('Erro ao atualizar log da integracao bancaria:', logErr)
      }
    }

    return { inseridos, duplicados, conciliados }
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

  // === Integrações Bancárias ===
  async listIntegracoes(tenantId: string, empresaId?: string): Promise<IntegracaoBancariaRecord[]> {
    let filter = `tenant_id = "${tenantId}"`
    if (empresaId && empresaId !== 'all') {
      filter += ` && empresa = "${empresaId}"`
    }
    return pb.collection('integracoes_bancarias').getFullList<IntegracaoBancariaRecord>({
      filter,
      sort: '-created',
      expand: 'empresa,conta_bancaria',
    })
  },

  async createIntegracao(data: {
    tenant_id: string
    empresa: string
    conta_bancaria: string
    modo: IntegracaoModo
    frequencia: IntegracaoFrequencia
    fonte_tipo: IntegracaoFonteTipo
    fonte_identificador: string
    status: IntegracaoStatus
    observacoes?: string
  }): Promise<IntegracaoBancariaRecord> {
    return pb.collection('integracoes_bancarias').create<IntegracaoBancariaRecord>({
      ...data,
      total_importados: 0,
      total_conciliados: 0,
    })
  },

  async updateIntegracao(
    id: string,
    data: Partial<IntegracaoBancariaRecord>,
  ): Promise<IntegracaoBancariaRecord> {
    return pb.collection('integracoes_bancarias').update<IntegracaoBancariaRecord>(id, data)
  },

  async deleteIntegracao(id: string): Promise<boolean> {
    return pb.collection('integracoes_bancarias').delete(id)
  },

  async listIntegracaoLogs(
    tenantId: string,
    integracaoId?: string,
    contaBancariaId?: string,
  ): Promise<IntegracaoLogRecord[]> {
    let filter = `tenant_id = "${tenantId}"`
    if (integracaoId) {
      filter += ` && integracao = "${integracaoId}"`
    }
    if (contaBancariaId && contaBancariaId !== 'all') {
      filter += ` && conta_bancaria = "${contaBancariaId}"`
    }
    return pb.collection('integracoes_logs').getFullList<IntegracaoLogRecord>({
      filter,
      sort: '-data_execucao',
      expand: 'integracao,conta_bancaria',
      limit: 100,
    })
  },

  // Simular processamento/importação "Importar agora" para uma integração bancária
  async executarImportacaoIntegracao(
    integracaoId: string,
    usuarioId?: string,
  ): Promise<{ inseridos: number; duplicados: number; conciliados: number }> {
    const integracao = await pb
      .collection('integracoes_bancarias')
      .getOne<IntegracaoBancariaRecord>(integracaoId, {
        expand: 'empresa,conta_bancaria',
      })

    // Itens sintéticos gerados para simular a remessa do banco/provedor
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const itensSimulados: ImportExtratoItem[] = [
      {
        data: `${todayStr} 10:15:00.000Z`,
        descricao: `TED REC AUTO ${integracao.expand?.empresa?.nome_fantasia || 'CLIENTE'}`,
        documento_numero: `DOC-AUTO-${Date.now().toString().slice(-4)}`,
        valor: 4500.0,
        tipo_transacao: 'credito',
      },
      {
        data: `${todayStr} 11:30:00.000Z`,
        descricao: 'DEB TARIFA TRANSACIONAL BANCARIA',
        documento_numero: `TAR-${Date.now().toString().slice(-3)}`,
        valor: -65.0,
        tipo_transacao: 'debito',
      },
    ]

    return this.importExtratoLote(
      integracao.tenant_id,
      integracao.empresa,
      integracao.conta_bancaria,
      itensSimulados,
      {
        autoMatch: true,
        usuarioId,
        integracaoId: integracao.id,
      },
    )
  },

  // === Relatório de Fluxo de Caixa & DFC Projeção ===
  async calcularFluxoCaixaEDFC(filtros: {
    tenantId: string
    empresaId?: string
    contaBancariaId?: string
    dataInicio: string
    dataFim: string
    agrupamento: 'semana' | 'mes'
  }): Promise<DFCFluxoResultado> {
    const { tenantId, empresaId, contaBancariaId, dataInicio, dataFim, agrupamento } = filtros

    // 1. Contas Bancárias para saldo inicial
    const contasBancarias = await this.listContasBancarias(
      tenantId,
      empresaId === 'all' ? undefined : empresaId,
    )
    const contasFiltradas =
      contaBancariaId && contaBancariaId !== 'all'
        ? contasBancarias.filter((c) => c.id === contaBancariaId)
        : contasBancarias

    const saldoInicialGeral = contasFiltradas.reduce((acc, c) => acc + (c.saldo_inicial || 0), 0)

    // 2. Extratos Bancários (Movimentos Realizados)
    let extratoFilter = `tenant_id = "${tenantId}"`
    if (empresaId && empresaId !== 'all') {
      extratoFilter += ` && empresa = "${empresaId}"`
    }
    if (contaBancariaId && contaBancariaId !== 'all') {
      extratoFilter += ` && conta_bancaria = "${contaBancariaId}"`
    }
    const extratos = await pb.collection('extratos_bancarios').getFullList<ExtratoBancarioRecord>({
      filter: extratoFilter,
      sort: 'data',
      expand: 'conta_bancaria,empresa,titulo_conciliado',
    })

    // 3. Títulos a Pagar e Receber (Realizados ou Futuros em Aberto)
    let tituloFilter = `tenant_id = "${tenantId}"`
    if (empresaId && empresaId !== 'all') {
      tituloFilter += ` && empresa = "${empresaId}"`
    }
    if (contaBancariaId && contaBancariaId !== 'all') {
      tituloFilter += ` && conta_bancaria = "${contaBancariaId}"`
    }
    const titulos = await pb.collection('contas_financeiras').getFullList<ContaFinanceiraRecord>({
      filter: tituloFilter,
      sort: 'data_vencimento',
      expand: 'empresa,categoria,conta_bancaria',
    })

    // Itens unificados para o fluxo
    const todosItens: FluxoCaixaItemProjecao[] = []

    // Adicionar extratos como movimentações realizadas
    extratos.forEach((ex) => {
      const dt = ex.data.split('T')[0]
      const isEntrada = ex.tipo_transacao === 'credito'
      todosItens.push({
        id: `extrato-${ex.id}`,
        origem: 'realizado',
        tipo: isEntrada ? 'entrada' : 'saida',
        data: dt,
        descricao: ex.descricao,
        pessoa: ex.expand?.titulo_conciliado?.pessoa || 'Movimento Extrato',
        documento: ex.documento_numero || undefined,
        valor: Math.abs(ex.valor),
        status: ex.status === 'conciliado' ? 'Conciliado' : 'Realizado (Extrato)',
        empresaNome: ex.expand?.empresa?.nome_fantasia || ex.expand?.empresa?.razao_social,
        contaBancariaNome: ex.expand?.conta_bancaria?.banco,
      })
    })

    // Adicionar títulos ainda não pagos como previstos/projetados (DFC indireto simplificado)
    titulos.forEach((t) => {
      // Se já está pago e já constou no extrato via vínculo, não duplicar
      const jaNoExtrato = extratos.some((ex) => ex.titulo_conciliado === t.id)
      if (t.status === 'pago' && jaNoExtrato) {
        return
      }

      if (t.status === 'cancelado') return

      const isEntrada = t.tipo === 'receber'
      const dataRef = t.status === 'pago' && t.data_pagamento ? t.data_pagamento : t.data_vencimento
      const dt = dataRef.split('T')[0]

      todosItens.push({
        id: `titulo-${t.id}`,
        origem: t.status === 'pago' ? 'realizado' : 'previsto',
        tipo: isEntrada ? 'entrada' : 'saida',
        data: dt,
        descricao: t.descricao,
        pessoa: t.pessoa,
        documento: t.documento_ref || undefined,
        valor: t.valor,
        status:
          t.status === 'pago'
            ? 'Pago (Financeiro)'
            : t.status === 'atrasado'
              ? 'Atrasado'
              : 'A Vencer',
        empresaNome: t.expand?.empresa?.nome_fantasia || t.expand?.empresa?.razao_social,
        contaBancariaNome: t.expand?.conta_bancaria?.banco,
        categoriaNome: t.expand?.categoria?.nome,
      })
    })

    // Filtrar itens dentro do intervalo de datas solicitado
    const itensNoPeriodo = todosItens.filter((item) => {
      if (dataInicio && item.data < dataInicio) return false
      if (dataFim && item.data > dataFim) return false
      return true
    })

    // Agrupar por semana ou mês
    const getGroupKey = (dateStr: string) => {
      const d = new Date(`${dateStr}T12:00:00Z`)
      if (agrupamento === 'mes') {
        const y = d.getUTCFullYear()
        const m = String(d.getUTCMonth() + 1).padStart(2, '0')
        return `${m}/${y}`
      } else {
        // Semana: calcular domingo a sábado da semana
        const day = d.getUTCDay()
        const diffSunday = d.getUTCDate() - day
        const sunday = new Date(d)
        sunday.setUTCDate(diffSunday)
        const saturday = new Date(sunday)
        saturday.setUTCDate(sunday.getUTCDate() + 6)
        const pad = (n: number) => String(n).padStart(2, '0')
        return `Semana ${pad(sunday.getUTCDate())}/${pad(sunday.getUTCMonth() + 1)} a ${pad(saturday.getUTCDate())}/${pad(saturday.getUTCMonth() + 1)}`
      }
    }

    const gruposMap = new Map<string, FluxoCaixaItemProjecao[]>()
    itensNoPeriodo.forEach((item) => {
      const key = getGroupKey(item.data)
      if (!gruposMap.has(key)) {
        gruposMap.set(key, [])
      }
      gruposMap.get(key)!.push(item)
    })

    // Ordenar períodos cronologicamente
    const periodosChaves = Array.from(gruposMap.keys()).sort((a, b) => {
      const itemA = gruposMap.get(a)?.[0]?.data || ''
      const itemB = gruposMap.get(b)?.[0]?.data || ''
      return itemA.localeCompare(itemB)
    })

    let saldoAcumulado = saldoInicialGeral
    let totalEntradasRealizadas = 0
    let totalEntradasPrevistas = 0
    let totalSaidasRealizadas = 0
    let totalSaidasPrevistas = 0

    const competencias: FluxoCaixaCompetenciaResumo[] = []

    periodosChaves.forEach((chave) => {
      const itensDoPeriodo = gruposMap.get(chave) || []
      const saldoIni = saldoAcumulado

      let entReal = 0
      let entPrev = 0
      let saiReal = 0
      let saiPrev = 0

      itensDoPeriodo.forEach((it) => {
        if (it.tipo === 'entrada') {
          if (it.origem === 'realizado') entReal += it.valor
          else entPrev += it.valor
        } else {
          if (it.origem === 'realizado') saiReal += it.valor
          else saiPrev += it.valor
        }
      })

      const totEnt = entReal + entPrev
      const totSai = saiReal + saiPrev
      const resultadoPeriodo = totEnt - totSai
      const saldoFim = saldoIni + resultadoPeriodo
      saldoAcumulado = saldoFim

      totalEntradasRealizadas += entReal
      totalEntradasPrevistas += entPrev
      totalSaidasRealizadas += saiReal
      totalSaidasPrevistas += saiPrev

      const datas = itensDoPeriodo.map((i) => i.data).sort()
      competencias.push({
        periodoRotulo: chave,
        dataInicio: datas[0] || '',
        dataFim: datas[datas.length - 1] || '',
        saldoInicial: saldoIni,
        entradasRealizadas: entReal,
        entradasPrevistas: entPrev,
        totalEntradas: totEnt,
        saidasRealizadas: saiReal,
        saidasPrevistas: saiPrev,
        totalSaidas: totSai,
        resultadoPeriodo,
        saldoFinal: saldoFim,
        isNegativo: saldoFim < 0,
        itens: itensDoPeriodo,
      })
    })

    const resultadoLiquidoOperacional =
      totalEntradasRealizadas +
      totalEntradasPrevistas -
      (totalSaidasRealizadas + totalSaidasPrevistas)

    return {
      saldoInicialGeral,
      saldoFinalProjetado: saldoAcumulado,
      totalEntradasRealizadas,
      totalEntradasPrevistas,
      totalSaidasRealizadas,
      totalSaidasPrevistas,
      resultadoLiquidoOperacional,
      competencias,
      itensDetalhados: itensNoPeriodo,
    }
  },
}

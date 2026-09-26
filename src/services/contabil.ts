import pb from '@/lib/pocketbase/client'
import type {
  ContaContabil,
  LancamentoContabil,
  BalanceteItem,
  ContaTipo,
  LancamentoStatus,
} from '@/types'

export interface CreatePartidaDobradaInput {
  tenant_id: string
  empresa: string
  data: string
  competencia: string
  valor: number
  historico: string
  debitoContaId: string
  creditoContaId: string
  documentoId?: string
  status: LancamentoStatus
  loteId?: string
  origem?: import('@/types').LancamentoOrigem
  criado_por?: string
}

export const contabilService = {
  // === Plano de Contas ===
  async getPlanoContas(tenantId: string, filter?: string) {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) finalFilter += ` && (${filter})`
    return pb.collection('plano_contas').getFullList<ContaContabil>({
      filter: finalFilter,
      sort: 'codigo',
      expand: 'pai',
    })
  },

  async createConta(data: Partial<ContaContabil>) {
    return pb.collection('plano_contas').create<ContaContabil>(data)
  },

  async updateConta(id: string, data: Partial<ContaContabil>) {
    return pb.collection('plano_contas').update<ContaContabil>(id, data)
  },

  async deleteConta(id: string) {
    return pb.collection('plano_contas').delete(id)
  },

  // === Lançamentos Contábeis ===
  async listLancamentos(
    tenantId: string,
    filters?: {
      empresaId?: string
      competencia?: string
      contaId?: string
      tipo?: string
      status?: string
      busca?: string
    },
    page = 1,
    perPage = 50,
  ) {
    const filterParts: string[] = [`tenant_id = "${tenantId}"`]

    if (filters?.empresaId && filters.empresaId !== 'todas') {
      filterParts.push(`empresa = "${filters.empresaId}"`)
    }
    if (filters?.competencia && filters.competencia !== 'todas') {
      filterParts.push(`competencia = "${filters.competencia}"`)
    }
    if (filters?.contaId && filters.contaId !== 'todas') {
      filterParts.push(
        `(conta_contabil = "${filters.contaId}" || contrapartida = "${filters.contaId}")`,
      )
    }
    if (filters?.tipo && filters.tipo !== 'todos') {
      filterParts.push(`tipo = "${filters.tipo}"`)
    }
    if (filters?.status && filters.status !== 'todos') {
      filterParts.push(`status = "${filters.status}"`)
    }
    if (filters?.busca && filters.busca.trim()) {
      filterParts.push(`historico ~ "${filters.busca.trim()}"`)
    }

    const filter = filterParts.join(' && ')

    return pb.collection('lancamentos_contabeis').getList<LancamentoContabil>(page, perPage, {
      filter,
      sort: '-data,-created',
      expand: 'empresa,conta_contabil,contrapartida,documento,criado_por',
    })
  },

  async getLancamento(id: string) {
    return pb.collection('lancamentos_contabeis').getOne<LancamentoContabil>(id, {
      expand: 'empresa,conta_contabil,contrapartida,documento,criado_por',
    })
  },

  // Criação de Partida Dobrada Atômica (Gera débito + crédito equilibrados com mesmo lote_id)
  async createPartidaDobrada(input: CreatePartidaDobradaInput) {
    // Validação preventiva: Trava de Competência Fechada
    if (input.competencia && input.empresa && input.tenant_id) {
      const fechamentos = await pb.collection('fechamento_competencia').getFullList({
        filter: `tenant_id = "${input.tenant_id}" && empresa = "${input.empresa}" && competencia = "${input.competencia}" && status = "fechado"`,
      })
      if (fechamentos.length > 0) {
        throw new Error(
          `A competência ${input.competencia} está formalmente fechada para esta empresa. Lançamentos retroativos não são permitidos.`,
        )
      }
    }

    const loteId = input.loteId || `LOTE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    // 1. Débito
    const debRecord = await pb.collection('lancamentos_contabeis').create<LancamentoContabil>({
      tenant_id: input.tenant_id,
      empresa: input.empresa,
      data: input.data,
      tipo: 'debito',
      conta_contabil: input.debitoContaId,
      contrapartida: input.creditoContaId,
      valor: input.valor,
      historico: input.historico,
      competencia: input.competencia,
      status: input.status,
      lote_id: loteId,
      origem: input.origem || 'manual',
      documento: input.documentoId || undefined,
      criado_por: input.criado_por || undefined,
    })

    // 2. Crédito
    const credRecord = await pb.collection('lancamentos_contabeis').create<LancamentoContabil>({
      tenant_id: input.tenant_id,
      empresa: input.empresa,
      data: input.data,
      tipo: 'credito',
      conta_contabil: input.creditoContaId,
      contrapartida: input.debitoContaId,
      valor: input.valor,
      historico: input.historico,
      competencia: input.competencia,
      status: input.status,
      lote_id: loteId,
      origem: input.origem || 'manual',
      documento: input.documentoId || undefined,
      criado_por: input.criado_por || undefined,
    })

    return { debRecord, credRecord, loteId }
  },

  async updateLancamento(id: string, data: Partial<LancamentoContabil>) {
    return pb.collection('lancamentos_contabeis').update<LancamentoContabil>(id, data)
  },

  async confirmarLancamento(id: string) {
    return pb
      .collection('lancamentos_contabeis')
      .update<LancamentoContabil>(id, { status: 'confirmado' })
  },

  async confirmarLote(loteId: string) {
    const records = await pb.collection('lancamentos_contabeis').getFullList<LancamentoContabil>({
      filter: `lote_id = "${loteId}"`,
    })
    return Promise.all(
      records.map((r) =>
        pb
          .collection('lancamentos_contabeis')
          .update<LancamentoContabil>(r.id, { status: 'confirmado' }),
      ),
    )
  },

  async deleteLancamento(id: string, deletePair = true) {
    if (deletePair) {
      try {
        const item = await pb.collection('lancamentos_contabeis').getOne<LancamentoContabil>(id)
        if (item.lote_id) {
          const brothers = await pb
            .collection('lancamentos_contabeis')
            .getFullList<LancamentoContabil>({
              filter: `lote_id = "${item.lote_id}" && id != "${item.id}"`,
            })
          for (const b of brothers) {
            await pb.collection('lancamentos_contabeis').delete(b.id)
          }
        }
      } catch {
        /* proceed to delete main */
      }
    }
    return pb.collection('lancamentos_contabeis').delete(id)
  },

  // === Balancete de Verificação ===
  // Helper para comparar competências no formato "MM/YYYY"
  // Retorna se compA < compB
  isCompetenciaAnterior(compA: string, compB: string): boolean {
    const [mA, yA] = compA.split('/').map(Number)
    const [mB, yB] = compB.split('/').map(Number)
    if (!mA || !yA || !mB || !yB) return false
    if (yA < yB) return true
    if (yA === yB && mA < mB) return true
    return false
  },

  async getBalancete(
    tenantId: string,
    empresaId: string,
    competenciaAtual: string,
  ): Promise<{
    itens: BalanceteItem[]
    totalDebitos: number
    totalCreditos: number
    fechado: boolean
    diferenca: number
  }> {
    // 1. Obter todas as contas do tenant
    const contas = await this.getPlanoContas(tenantId, 'ativa = true')

    // 2. Obter todos os lançamentos confirmados da empresa
    const filter = `tenant_id = "${tenantId}" && empresa = "${empresaId}" && status = "confirmado"`
    const lancamentos = await pb
      .collection('lancamentos_contabeis')
      .getFullList<LancamentoContabil>({
        filter,
        sort: 'data',
      })

    // 3. Mapear movimentações por conta_contabil
    // Saldo anterior: soma de movimentos onde comp < competenciaAtual
    // Movimento do período: soma de débitos e créditos onde comp === competenciaAtual
    const acumuladores: Record<
      string,
      {
        saldoAnteriorDebito: number
        saldoAnteriorCredito: number
        debitosPeriodo: number
        creditosPeriodo: number
      }
    > = {}

    for (const c of contas) {
      acumuladores[c.id] = {
        saldoAnteriorDebito: 0,
        saldoAnteriorCredito: 0,
        debitosPeriodo: 0,
        creditosPeriodo: 0,
      }
    }

    for (const l of lancamentos) {
      const contaId = l.conta_contabil
      if (!acumuladores[contaId]) {
        acumuladores[contaId] = {
          saldoAnteriorDebito: 0,
          saldoAnteriorCredito: 0,
          debitosPeriodo: 0,
          creditosPeriodo: 0,
        }
      }

      const isAnterior = this.isCompetenciaAnterior(l.competencia, competenciaAtual)
      const isPeriodo = l.competencia === competenciaAtual

      if (isAnterior) {
        if (l.tipo === 'debito') {
          acumuladores[contaId].saldoAnteriorDebito += l.valor
        } else {
          acumuladores[contaId].saldoAnteriorCredito += l.valor
        }
      } else if (isPeriodo) {
        if (l.tipo === 'debito') {
          acumuladores[contaId].debitosPeriodo += l.valor
        } else {
          acumuladores[contaId].creditosPeriodo += l.valor
        }
      }
    }

    // Identificar contas sintéticas (que possuem filhas no plano de contas)
    const contasComFilhos = new Set<string>()
    contas.forEach((c) => {
      if (c.pai) contasComFilhos.add(c.pai)
    })

    // Calcular saldos analíticos
    // Convenção contábil padrão brasileira:
    // Contas de Natureza Devedora (Ativo, Despesa): Saldo = Débitos - Créditos
    // Contas de Natureza Credora (Passivo, Patrimônio, Receita): Saldo = Créditos - Débitos
    const getSaldoPorNatureza = (tipo: ContaTipo, deb: number, cred: number) => {
      if (tipo === 'ativo' || tipo === 'despesa') {
        return deb - cred
      }
      return cred - deb
    }

    // Construir lista inicial de BalanceteItem
    const itensMap: Record<string, BalanceteItem> = {}

    for (const c of contas) {
      const isSintetica = contasComFilhos.has(c.id)
      const acc = acumuladores[c.id] || {
        saldoAnteriorDebito: 0,
        saldoAnteriorCredito: 0,
        debitosPeriodo: 0,
        creditosPeriodo: 0,
      }

      let saldoAnt = 0
      let saldoAtu = 0
      let deb = 0
      let cred = 0

      if (!isSintetica) {
        saldoAnt = getSaldoPorNatureza(c.tipo, acc.saldoAnteriorDebito, acc.saldoAnteriorCredito)
        deb = acc.debitosPeriodo
        cred = acc.creditosPeriodo
        const debTotal = acc.saldoAnteriorDebito + deb
        const credTotal = acc.saldoAnteriorCredito + cred
        saldoAtu = getSaldoPorNatureza(c.tipo, debTotal, credTotal)
      }

      itensMap[c.id] = {
        id: c.id,
        codigo: c.codigo,
        nome: c.nome,
        tipo: c.tipo,
        nivel: c.nivel || 1,
        pai: c.pai,
        isSintetica,
        saldoAnterior: saldoAnt,
        debitos: deb,
        creditos: cred,
        saldoAtual: saldoAtu,
      }
    }

    // Rolar para cima a agregação nas contas sintéticas (de maior nível para menor nível)
    const contasOrdenadasPorNivelDesc = [...contas].sort((a, b) => (b.nivel || 1) - (a.nivel || 1))

    for (const c of contasOrdenadasPorNivelDesc) {
      if (c.pai && itensMap[c.pai]) {
        const itemPai = itensMap[c.pai]
        const itemFilho = itensMap[c.id]
        if (itemFilho.isSintetica) {
          // Se o filho for sintético, seus valores já consolidaram os netos
          itemPai.saldoAnterior += itemFilho.saldoAnterior
          itemPai.debitos += itemFilho.debitos
          itemPai.creditos += itemFilho.creditos
          itemPai.saldoAtual += itemFilho.saldoAtual
        } else {
          itemPai.saldoAnterior += itemFilho.saldoAnterior
          itemPai.debitos += itemFilho.debitos
          itemPai.creditos += itemFilho.creditos
          itemPai.saldoAtual += itemFilho.saldoAtual
        }
      }
    }

    // Lista final ordenada por código contábil
    const itens = Object.values(itensMap).sort((a, b) =>
      a.codigo.localeCompare(b.codigo, undefined, { numeric: true }),
    )

    // Totais gerais do período (somente contas analíticas para evitar dupla contagem)
    let totalDebitos = 0
    let totalCreditos = 0

    itens.forEach((it) => {
      if (!it.isSintetica) {
        totalDebitos += it.debitos
        totalCreditos += it.creditos
      }
    })

    const diferenca = Math.abs(totalDebitos - totalCreditos)
    const fechado = diferenca < 0.009

    return {
      itens,
      totalDebitos,
      totalCreditos,
      fechado,
      diferenca,
    }
  },
}

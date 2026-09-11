import pb from '@/lib/pocketbase/client'
import type {
  MapeamentoContabil,
  MapeamentoOrigem,
  ObrigacaoRecord,
  LancamentoContabil,
  ContaContabil,
} from '@/types'

export interface FechoResultado {
  processados: number
  lancamentosGerados: number
  valorTotal: number
  pendentesMapeamento: string[]
}

export const fechoContabilService = {
  // === Regras de Mapeamento Contábil ===
  async listMapeamentos(tenantId: string) {
    return pb.collection('mapeamento_contabil').getFullList<MapeamentoContabil>({
      filter: `tenant_id = "${tenantId}"`,
      sort: 'origem,chave',
      expand: 'conta_debito,conta_credito',
    })
  },

  async createMapeamento(data: {
    tenant_id: string
    origem: MapeamentoOrigem
    chave: string
    descricao?: string
    conta_debito: string
    conta_credito: string
  }) {
    return pb.collection('mapeamento_contabil').create<MapeamentoContabil>(data)
  },

  async updateMapeamento(
    id: string,
    data: Partial<{
      chave: string
      descricao: string
      conta_debito: string
      conta_credito: string
    }>,
  ) {
    return pb.collection('mapeamento_contabil').update<MapeamentoContabil>(id, data)
  },

  async deleteMapeamento(id: string) {
    return pb.collection('mapeamento_contabil').delete(id)
  },

  // === Processar Fecho em Lote (Obrigações Fiscais Pagas / Entregues) ===
  async processarFechoLote(
    tenantId: string,
    competencia: string,
    empresaId?: string,
  ): Promise<FechoResultado> {
    // 1. Buscar regras de mapeamento do tenant para obrigacoes
    const mapeamentos = await pb.collection('mapeamento_contabil').getFullList<MapeamentoContabil>({
      filter: `tenant_id = "${tenantId}" && origem = "obrigacao"`,
    })
    const mapByChave = new Map<string, MapeamentoContabil>()
    mapeamentos.forEach((m) => {
      mapByChave.set(m.chave.toUpperCase(), m)
    })

    // 2. Buscar obrigações entregues/pagas
    let filterObr = `tenant_id = "${tenantId}" && status = "entregue"`
    if (competencia && competencia !== 'todas') {
      filterObr += ` && competencia = "${competencia}"`
    }
    if (empresaId && empresaId !== 'todas') {
      filterObr += ` && empresa_id = "${empresaId}"`
    }

    const obrigacoes = await pb.collection('obrigacoes').getFullList<ObrigacaoRecord>({
      filter: filterObr,
    })

    let lancamentosGerados = 0
    let valorTotal = 0
    let processados = 0
    const pendentesMapeamento = new Set<string>()

    for (const obr of obrigacoes) {
      const chave = obr.tipo.toUpperCase()
      const map = mapByChave.get(chave)

      if (!map) {
        pendentesMapeamento.add(obr.tipo)
        continue
      }

      const valor = obr.valor || 0
      if (valor <= 0) continue

      // Verificar se já existe lançamento para esta obrigação
      const loteId = `LOTE-OBR-${obr.id}`
      const existentes = await pb
        .collection('lancamentos_contabeis')
        .getFullList<LancamentoContabil>({
          filter: `tenant_id = "${tenantId}" && lote_id = "${loteId}"`,
        })

      if (existentes.length > 0) {
        continue
      }

      // Criar a partida dobrada
      const dataLanc = obr.data_entrega || obr.vencimento || new Date().toISOString()
      const historico = `Liquidação de guia fiscal ${obr.tipo} ref. comp. ${obr.competencia} (Fecho Automático)`

      // Débito
      await pb.collection('lancamentos_contabeis').create<LancamentoContabil>({
        tenant_id: tenantId,
        empresa: obr.empresa_id,
        data: dataLanc,
        tipo: 'debito',
        conta_contabil: map.conta_debito,
        contrapartida: map.conta_credito,
        valor,
        historico,
        competencia: obr.competencia || competencia,
        status: 'confirmado',
        lote_id: loteId,
      })

      // Crédito
      await pb.collection('lancamentos_contabeis').create<LancamentoContabil>({
        tenant_id: tenantId,
        empresa: obr.empresa_id,
        data: dataLanc,
        tipo: 'credito',
        conta_contabil: map.conta_credito,
        contrapartida: map.conta_debito,
        valor,
        historico,
        competencia: obr.competencia || competencia,
        status: 'confirmado',
        lote_id: loteId,
      })

      processados++
      lancamentosGerados += 2
      valorTotal += valor
    }

    return {
      processados,
      lancamentosGerados,
      valorTotal,
      pendentesMapeamento: Array.from(pendentesMapeamento),
    }
  },
}

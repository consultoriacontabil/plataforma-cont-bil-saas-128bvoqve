import pb from '@/lib/pocketbase/client'
import type {
  AtivoPatrimonial,
  AtivoCategoria,
  AtivoStatus,
  TipoBaixaAtivo,
  BaixaAtivoRecord,
  PatrimonioTransferenciaRecord,
  LancamentoContabil,
} from '@/types'
import { auditService } from '@/services/audit'

export interface CreateAtivoInput {
  tenant_id: string
  empresa: string
  descricao: string
  categoria: AtivoCategoria
  numero_nf?: string
  fornecedor?: string
  data_aquisicao: string
  valor_aquisicao: number
  valor_residual: number
  taxa_depreciacao_anual: number
  vida_util_meses?: number
  conta_ativo: string
  conta_depreciacao_acumulada?: string
  conta_despesa_depreciacao?: string
  setor_localizacao?: string
  filial_unidade?: string
  responsavel_bem?: string
  status?: AtivoStatus
  observacoes?: string
}

export interface TransferirAtivoInput {
  tenant_id: string
  empresa_id: string
  ativo_id: string
  data_transferencia: string
  destino_setor: string
  destino_filial?: string
  destino_responsavel: string
  motivo?: string
  observacao?: string
  usuario_id?: string
}

export interface RegistrarBaixaInput {
  tenant_id: string
  ativoId: string
  empresaId: string
  tipo_baixa: TipoBaixaAtivo
  data_baixa: string
  valor_venda?: number
  motivo?: string
  usuario_id?: string
}

export interface ProcessarDepreciacaoResultado {
  ativosProcessados: number
  lancamentosGerados: number
  valorTotalDepreciacao: number
  detalhes: {
    ativoId: string
    descricao: string
    quotaMensal: number
  }[]
}

export const patrimonioService = {
  // === Ativos Patrimoniais ===
  async listAtivos(
    tenantId: string,
    filters?: {
      empresaId?: string
      categoria?: string
      status?: string
      busca?: string
    },
  ) {
    const filterParts: string[] = [`tenant_id = "${tenantId}"`]

    if (filters?.empresaId && filters.empresaId !== 'todas') {
      filterParts.push(`empresa = "${filters.empresaId}"`)
    }
    if (filters?.categoria && filters.categoria !== 'todas') {
      filterParts.push(`categoria = "${filters.categoria}"`)
    }
    if (filters?.status && filters.status !== 'todos') {
      filterParts.push(`status = "${filters.status}"`)
    }
    if (filters?.busca && filters.busca.trim()) {
      filterParts.push(
        `(descricao ~ "${filters.busca.trim()}" || numero_nf ~ "${filters.busca.trim()}" || fornecedor ~ "${filters.busca.trim()}")`,
      )
    }

    const filter = filterParts.join(' && ')

    return pb.collection('ativos').getFullList<AtivoPatrimonial>({
      filter,
      sort: '-data_aquisicao,-created',
      expand: 'empresa,conta_ativo,conta_depreciacao_acumulada,conta_despesa_depreciacao',
    })
  },

  async getAtivo(id: string) {
    return pb.collection('ativos').getOne<AtivoPatrimonial>(id, {
      expand: 'empresa,conta_ativo,conta_depreciacao_acumulada,conta_despesa_depreciacao',
    })
  },

  async createAtivo(data: CreateAtivoInput) {
    return pb.collection('ativos').create<AtivoPatrimonial>({
      ...data,
      status: data.status || 'ativo',
      depreciacao_acumulada_calculada: 0,
    })
  },

  async updateAtivo(id: string, data: Partial<AtivoPatrimonial>) {
    return pb.collection('ativos').update<AtivoPatrimonial>(id, data)
  },

  async deleteAtivo(id: string) {
    return pb.collection('ativos').delete(id)
  },

  // Cálculo da quota mensal linear:
  // Quota Mensal = (Valor de Aquisição - Valor Residual) * (Taxa Anual % / 100) / 12
  calcularQuotaMensal(ativo: AtivoPatrimonial): number {
    const baseCalculo = Math.max(0, (ativo.valor_aquisicao || 0) - (ativo.valor_residual || 0))
    const taxa = (ativo.taxa_depreciacao_anual || 0) / 100
    const quota = (baseCalculo * taxa) / 12
    return Math.round(quota * 100) / 100
  },

  // === Processar Depreciação por Competência e Empresa ===
  async processarDepreciacao(
    tenantId: string,
    empresaId: string,
    competencia: string,
    usuarioId?: string,
  ): Promise<ProcessarDepreciacaoResultado> {
    // 1. Buscar todos os bens ativos da empresa
    const filter = `tenant_id = "${tenantId}" && empresa = "${empresaId}" && status = "ativo"`
    const ativos = await pb.collection('ativos').getFullList<AtivoPatrimonial>({ filter })

    let ativosProcessados = 0
    let lancamentosGerados = 0
    let valorTotalDepreciacao = 0
    const detalhes: { ativoId: string; descricao: string; quotaMensal: number }[] = []

    for (const ativo of ativos) {
      // Anti-duplicidade: verificar se já existe lançamento de depreciação deste ativo na competência
      const loteId = `LOTE-DEP-${ativo.id}-${competencia.replace('/', '-')}`
      const existentes = await pb
        .collection('lancamentos_contabeis')
        .getFullList<LancamentoContabil>({
          filter: `tenant_id = "${tenantId}" && lote_id = "${loteId}"`,
        })

      if (existentes.length > 0) {
        continue
      }

      // Se já depreciou integralmente até o valor residual
      const valorDepreciavel = Math.max(0, ativo.valor_aquisicao - (ativo.valor_residual || 0))
      const depAcumAtual = ativo.depreciacao_acumulada_calculada || 0
      if (depAcumAtual >= valorDepreciavel) {
        // Atualizar status para depreciado
        await pb.collection('ativos').update(ativo.id, { status: 'depreciado' })
        continue
      }

      let quota = this.calcularQuotaMensal(ativo)
      // Se a quota ultrapassar o saldo depreciável restante, limitar
      if (depAcumAtual + quota > valorDepreciavel) {
        quota = Math.round((valorDepreciavel - depAcumAtual) * 100) / 100
      }

      if (quota <= 0) continue

      const contaDespesa = ativo.conta_despesa_depreciacao
      const contaAcumulada = ativo.conta_depreciacao_acumulada

      if (!contaDespesa || !contaAcumulada) {
        console.warn(`Ativo ${ativo.descricao} não possui contas de depreciação vinculadas.`)
        continue
      }

      const [mes, ano] = competencia.split('/')
      const ultimoDiaMes = new Date(parseInt(ano, 10), parseInt(mes, 10), 0).getDate()
      const dataLancamento = `${ano}-${mes.padStart(2, '0')}-${ultimoDiaMes.toString().padStart(2, '0')} 23:59:59.000Z`
      const historico = `Depreciação linear do bem ${ativo.descricao} ref. comp. ${competencia}`

      // 1. Débito em Despesa de Depreciação
      await pb.collection('lancamentos_contabeis').create<LancamentoContabil>({
        tenant_id: tenantId,
        empresa: empresaId,
        data: dataLancamento,
        tipo: 'debito',
        conta_contabil: contaDespesa,
        contrapartida: contaAcumulada,
        valor: quota,
        historico,
        competencia,
        status: 'confirmado',
        lote_id: loteId,
        criado_por: usuarioId || undefined,
      })

      // 2. Crédito em Depreciação Acumulada
      await pb.collection('lancamentos_contabeis').create<LancamentoContabil>({
        tenant_id: tenantId,
        empresa: empresaId,
        data: dataLancamento,
        tipo: 'credito',
        conta_contabil: contaAcumulada,
        contrapartida: contaDespesa,
        valor: quota,
        historico,
        competencia,
        status: 'confirmado',
        lote_id: loteId,
        criado_por: usuarioId || undefined,
      })

      // Atualizar o ativo com a nova depreciação acumulada
      const novaDepAcum = Math.round((depAcumAtual + quota) * 100) / 100
      const isTotalmenteDepreciado = novaDepAcum >= valorDepreciavel

      await pb.collection('ativos').update(ativo.id, {
        depreciacao_acumulada_calculada: novaDepAcum,
        ultima_competencia_depreciada: competencia,
        status: isTotalmenteDepreciado ? 'depreciado' : 'ativo',
      })

      ativosProcessados++
      lancamentosGerados += 2
      valorTotalDepreciacao += quota
      detalhes.push({
        ativoId: ativo.id,
        descricao: ativo.descricao,
        quotaMensal: quota,
      })
    }

    return {
      ativosProcessados,
      lancamentosGerados,
      valorTotalDepreciacao,
      detalhes,
    }
  },

  // === Baixa de Ativos ===
  async registrarBaixa(input: RegistrarBaixaInput) {
    const ativo = await this.getAtivo(input.ativoId)
    const valorAquisicao = ativo.valor_aquisicao
    const depAcumulada = ativo.depreciacao_acumulada_calculada || 0
    const valorContabilLiquido = Math.max(0, valorAquisicao - depAcumulada)
    const valorVenda = input.valor_venda || 0
    const ganhoPerda = Math.round((valorVenda - valorContabilLiquido) * 100) / 100

    const loteId = `LOTE-BAIXA-${ativo.id}-${Date.now()}`

    // Competência do dia da baixa
    const dataBaixaDate = new Date(input.data_baixa)
    const mes = (dataBaixaDate.getUTCMonth() + 1).toString().padStart(2, '0')
    const ano = dataBaixaDate.getUTCFullYear()
    const competencia = `${mes}/${ano}`

    // 1. Criar Lançamentos Contábeis de Saída do Ativo e da Depreciação Acumulada
    // Se houver contas configuradas:
    if (ativo.conta_ativo && ativo.conta_depreciacao_acumulada) {
      // A) Baixa da depreciação acumulada (Débito em Depreciação Acumulada, Crédito em Ativo)
      if (depAcumulada > 0) {
        await pb.collection('lancamentos_contabeis').create<LancamentoContabil>({
          tenant_id: input.tenant_id,
          empresa: input.empresaId,
          data: input.data_baixa,
          tipo: 'debito',
          conta_contabil: ativo.conta_depreciacao_acumulada,
          contrapartida: ativo.conta_ativo,
          valor: depAcumulada,
          historico: `Baixa da depreciação acumulada por ${input.tipo_baixa} do bem ${ativo.descricao}`,
          competencia,
          status: 'confirmado',
          lote_id: loteId,
          criado_por: input.usuario_id || undefined,
        })
      }

      // B) Saída do valor de custo do ativo (Crédito na Conta do Ativo)
      // Se teve venda: Débito em Bancos/Caixa pelo valor de venda
      // A contrapartida do saldo residual vai para Ganho/Perda de Capital
      let contaBanco = ''
      try {
        const contasBancos = await pb.collection('plano_contas').getFullList({
          filter: `tenant_id = "${input.tenant_id}" && codigo = "1.1.1.02"`,
        })
        if (contasBancos.length > 0) contaBanco = contasBancos[0].id
      } catch {
        /* intentionally ignored */
      }

      // Lançamento de saída do custo total do ativo
      await pb.collection('lancamentos_contabeis').create<LancamentoContabil>({
        tenant_id: input.tenant_id,
        empresa: input.empresaId,
        data: input.data_baixa,
        tipo: 'credito',
        conta_contabil: ativo.conta_ativo,
        contrapartida: contaBanco || ativo.conta_depreciacao_acumulada,
        valor: valorAquisicao,
        historico: `Baixa do custo de aquisição por ${input.tipo_baixa} do bem ${ativo.descricao}`,
        competencia,
        status: 'confirmado',
        lote_id: loteId,
        criado_por: input.usuario_id || undefined,
      })

      // Se houve valor de venda, entrada em banco
      if (valorVenda > 0 && contaBanco) {
        await pb.collection('lancamentos_contabeis').create<LancamentoContabil>({
          tenant_id: input.tenant_id,
          empresa: input.empresaId,
          data: input.data_baixa,
          tipo: 'debito',
          conta_contabil: contaBanco,
          contrapartida: ativo.conta_ativo,
          valor: valorVenda,
          historico: `Recebimento referente à alienação/venda do bem ${ativo.descricao}`,
          competencia,
          status: 'confirmado',
          lote_id: loteId,
          criado_por: input.usuario_id || undefined,
        })
      }
    }

    // 2. Registrar na coleção baixas_ativos
    const baixa = await pb.collection('baixas_ativos').create<BaixaAtivoRecord>({
      tenant_id: input.tenant_id,
      ativo: input.ativoId,
      empresa: input.empresaId,
      tipo_baixa: input.tipo_baixa,
      data_baixa: input.data_baixa,
      valor_venda: valorVenda,
      valor_contabil_residual: valorContabilLiquido,
      ganho_perda: ganhoPerda,
      lote_contabil_id: loteId,
      motivo: input.motivo || undefined,
      usuario_id: input.usuario_id || undefined,
    })

    // 3. Atualizar status do ativo para "baixado"
    await pb.collection('ativos').update(input.ativoId, {
      status: 'baixado',
    })

    return baixa
  },

  // === Baixas Histórico ===
  async listBaixas(tenantId: string, empresaId?: string) {
    let filter = `tenant_id = "${tenantId}"`
    if (empresaId && empresaId !== 'todas') {
      filter += ` && empresa = "${empresaId}"`
    }
    return pb.collection('baixas_ativos').getFullList<BaixaAtivoRecord>({
      filter,
      sort: '-data_baixa',
      expand: 'ativo,empresa,usuario_id',
    })
  },

  // === Transferência Física de Ativos (FASE 3) ===
  async transferirAtivo(input: TransferirAtivoInput): Promise<PatrimonioTransferenciaRecord> {
    const ativo = await this.getAtivo(input.ativo_id)

    // 1. Gravar registro no histórico de transferências
    const registro = await pb
      .collection('patrimonio_transferencias')
      .create<PatrimonioTransferenciaRecord>({
        tenant_id: input.tenant_id,
        empresa: input.empresa_id,
        ativo: input.ativo_id,
        data_transferencia: input.data_transferencia,
        origem_setor: ativo.setor_localizacao || 'Não definido',
        origem_filial: ativo.filial_unidade || 'Matriz',
        origem_responsavel: ativo.responsavel_bem || 'Geral',
        destino_setor: input.destino_setor,
        destino_filial: input.destino_filial || ativo.filial_unidade || 'Matriz',
        destino_responsavel: input.destino_responsavel,
        motivo: input.motivo || '',
        observacao: input.observacao || '',
        usuario_id: input.usuario_id || undefined,
      })

    // 2. Atualizar localização e responsável atuais na coleção 'ativos'
    await pb.collection('ativos').update(input.ativo_id, {
      setor_localizacao: input.destino_setor,
      filial_unidade: input.destino_filial || ativo.filial_unidade || 'Matriz',
      responsavel_bem: input.destino_responsavel,
    })

    // 3. Registrar na auditoria
    await auditService.log(
      input.tenant_id,
      input.usuario_id || '',
      'transferencia_ativo_patrimonial',
      'ativos',
      input.ativo_id,
      `Transferência interna do bem '${ativo.descricao}': de [${ativo.setor_localizacao || 'Geral'} / ${ativo.responsavel_bem || 'N/A'}] para [${input.destino_setor} / ${input.destino_responsavel}]. Motivo: ${input.motivo || 'Reorganização operacional'}.`,
    )

    return registro
  },

  async listTransferencias(tenantId: string, filters?: { ativoId?: string; empresaId?: string }) {
    const filterParts: string[] = [`tenant_id = "${tenantId}"`]

    if (filters?.ativoId) {
      filterParts.push(`ativo = "${filters.ativoId}"`)
    }
    if (filters?.empresaId && filters.empresaId !== 'todas') {
      filterParts.push(`empresa = "${filters.empresaId}"`)
    }

    return pb.collection('patrimonio_transferencias').getFullList<PatrimonioTransferenciaRecord>({
      filter: filterParts.join(' && '),
      sort: '-data_transferencia,-created',
      expand: 'ativo,empresa,usuario_id',
    })
  },
}

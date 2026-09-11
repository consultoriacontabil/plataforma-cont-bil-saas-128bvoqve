import pb from '@/lib/pocketbase/client'
import { contabilService } from '@/services/contabil'
import type {
  ImpostoRetidoRecord,
  ImpostoRetidoTipo,
  ImpostoRetidoStatus,
  ContaFinanceiraRecord,
  ContaContabil,
} from '@/types'

export interface GerarImpostosRetidosInput {
  tenantId: string
  empresaId: string
  competencia: string
  inssTotal: number
  irrfTotal: number
  fgtsTotal: number
  folhaIdRef?: string
}

export const impostosRetidosService = {
  // Listar impostos retidos
  async list(
    tenantId: string,
    filters?: {
      empresaId?: string
      competencia?: string
      tipo?: ImpostoRetidoTipo | 'todos'
      status?: ImpostoRetidoStatus | 'todos'
    },
  ): Promise<ImpostoRetidoRecord[]> {
    const filterParts: string[] = [`tenant_id = "${tenantId}"`]

    if (filters?.empresaId && filters.empresaId !== 'todas') {
      filterParts.push(`empresa = "${filters.empresaId}"`)
    }
    if (filters?.competencia && filters.competencia !== 'todas') {
      filterParts.push(`competencia = "${filters.competencia}"`)
    }
    if (filters?.tipo && filters.tipo !== 'todos') {
      filterParts.push(`tipo = "${filters.tipo}"`)
    }
    if (filters?.status && filters.status !== 'todos') {
      filterParts.push(`status = "${filters.status}"`)
    }

    return pb.collection('impostos_retidos').getFullList<ImpostoRetidoRecord>({
      filter: filterParts.join(' && '),
      sort: 'vencimento,-created',
      expand: 'empresa,vinculo_titulo_financeiro',
    })
  },

  // Calcular vencimento a partir da competência MM/AAAA
  // DARF INSS e IRRF: dia 20 do mês seguinte
  // FGTS: dia 07 do mês seguinte
  calcularVencimento(competencia: string, tipo: ImpostoRetidoTipo): string {
    const parts = competencia.split('/')
    let mes = parseInt(parts[0], 10)
    let ano = parseInt(parts[1], 10)

    if (isNaN(mes) || isNaN(ano)) {
      const now = new Date()
      mes = now.getMonth() + 1
      ano = now.getFullYear()
    }

    // Mês seguinte
    let mesSeguinte = mes + 1
    let anoSeguinte = ano
    if (mesSeguinte > 12) {
      mesSeguinte = 1
      anoSeguinte += 1
    }

    const dia = tipo === 'fgts' ? 7 : 20
    const mesStr = String(mesSeguinte).padStart(2, '0')
    const diaStr = String(dia).padStart(2, '0')

    return `${anoSeguinte}-${mesStr}-${diaStr}T18:00:00.000Z`
  },

  // Gerar impostos retidos a partir da folha com anti-duplicidade
  async gerarOuAtualizarImpostosFolha(
    input: GerarImpostosRetidosInput,
  ): Promise<{ gerados: number; atualizados: number }> {
    const { tenantId, empresaId, competencia, inssTotal, irrfTotal, fgtsTotal, folhaIdRef } = input

    // Buscar plano de contas para categoria padrão de tributos se existir
    const contas = await pb.collection('plano_contas').getFullList<ContaContabil>({
      filter: `tenant_id = "${tenantId}" && ativa = true`,
    })

    const contaPassivoImpostos =
      contas.find((c) => c.codigo.startsWith('2.1.2') || c.codigo.startsWith('2.1.3')) ||
      contas.find((c) => c.tipo === 'passivo')

    const itensParaGerar: {
      tipo: ImpostoRetidoTipo
      valor: number
      descricao: string
      pessoa: string
    }[] = [
      {
        tipo: 'darf_inss',
        valor: Number(inssTotal.toFixed(2)),
        descricao: `DARF Previdenciário (INSS Colaboradores) Comp. ${competencia}`,
        pessoa: 'Receita Federal do Brasil (INSS)',
      },
      {
        tipo: 'darf_irrf',
        valor: Number(irrfTotal.toFixed(2)),
        descricao: `DARF Retenção de IRRF Folha Comp. ${competencia}`,
        pessoa: 'Receita Federal do Brasil (IRRF)',
      },
      {
        tipo: 'fgts',
        valor: Number(fgtsTotal.toFixed(2)),
        descricao: `Guia de FGTS Digital Comp. ${competencia}`,
        pessoa: 'Caixa Econômica Federal (FGTS)',
      },
    ]

    let gerados = 0
    let atualizados = 0

    for (const item of itensParaGerar) {
      if (item.valor <= 0) continue

      const vencimento = this.calcularVencimento(competencia, item.tipo)

      // Verificar se já existe registro para empresa + competência + tipo (anti-duplicidade)
      const existentes = await pb.collection('impostos_retidos').getFullList<ImpostoRetidoRecord>({
        filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}" && tipo = "${item.tipo}"`,
      })

      if (existentes.length > 0) {
        const existente = existentes[0]
        // Se ainda não estiver pago, atualiza o valor
        if (existente.status !== 'pago') {
          await pb.collection('impostos_retidos').update(existente.id, {
            valor: item.valor,
            vencimento,
            vinculo_folha: folhaIdRef || existente.vinculo_folha,
          })

          // Se tiver título financeiro atrelado, atualiza também
          if (existente.vinculo_titulo_financeiro) {
            await pb.collection('contas_financeiras').update(existente.vinculo_titulo_financeiro, {
              valor: item.valor,
              data_vencimento: vencimento,
            })
          }
          atualizados++
        }
      } else {
        // Criar título no contas_financeiras correspondente (a pagar)
        const tituloFin = await pb.collection('contas_financeiras').create<ContaFinanceiraRecord>({
          tenant_id: tenantId,
          empresa: empresaId,
          tipo: 'pagar',
          pessoa: item.pessoa,
          descricao: item.descricao,
          documento_ref: `RET-${competencia.replace('/', '')}-${item.tipo.toUpperCase()}`,
          valor: item.valor,
          categoria: contaPassivoImpostos?.id || undefined,
          data_emissao: new Date().toISOString(),
          data_vencimento: vencimento,
          status: 'pendente',
          observacoes: `Integração DP -> Financeiro (Comp. ${competencia})`,
        })

        // Criar imposto retido
        await pb.collection('impostos_retidos').create({
          tenant_id: tenantId,
          empresa: empresaId,
          competencia,
          tipo: item.tipo,
          valor: item.valor,
          vencimento,
          status: 'pendente',
          vinculo_folha: folhaIdRef || `folha-${competencia}`,
          vinculo_titulo_financeiro: tituloFin.id,
          observacoes: `Retenção gerada da folha de pagamento ${competencia}`,
        })
        gerados++
      }
    }

    return { gerados, atualizados }
  },

  // Marcar imposto retido como pago + integração com Fecho Contábil automático (partida dobrada)
  async pagarImpostoRetido(
    impostoId: string,
    contaBancariaId?: string,
    usuarioId?: string,
  ): Promise<ImpostoRetidoRecord> {
    const imposto = await pb
      .collection('impostos_retidos')
      .getOne<ImpostoRetidoRecord>(impostoId, { expand: 'empresa,vinculo_titulo_financeiro' })

    const now = new Date().toISOString()
    const loteContabilId = `LOTE-RET-${imposto.id}`

    // 1. Atualizar registro em impostos_retidos
    const updated = await pb.collection('impostos_retidos').update<ImpostoRetidoRecord>(
      impostoId,
      {
        status: 'pago',
        pago_em: now,
        lote_contabil: loteContabilId,
      },
      { expand: 'empresa,vinculo_titulo_financeiro' },
    )

    // 2. Atualizar título correspondente em contas_financeiras
    if (imposto.vinculo_titulo_financeiro) {
      try {
        await pb.collection('contas_financeiras').update(imposto.vinculo_titulo_financeiro, {
          status: 'pago',
          data_pagamento: now,
          conta_bancaria: contaBancariaId || undefined,
          lote_contabil_id: loteContabilId,
        })
      } catch (errFin) {
        console.warn('Erro ao atualizar titulo financeiro do imposto retido:', errFin)
      }
    }

    // 3. Integração Contábil Automática (Partida Dobrada Débito Impostos a Recolher, Crédito Banco)
    try {
      const tenantId = imposto.tenant_id
      const empresaId = imposto.empresa

      // Buscar mapeamento contábil existente ou contas padrão
      const chaveMapeamento =
        imposto.tipo === 'fgts' ? 'FGTS' : imposto.tipo === 'darf_inss' ? 'INSS' : 'DARF'
      const maps = await pb.collection('mapeamento_contabil').getFullList({
        filter: `tenant_id = "${tenantId}" && origem = "obrigacao" && chave = "${chaveMapeamento}"`,
      })

      const contas = await pb.collection('plano_contas').getFullList<ContaContabil>({
        filter: `tenant_id = "${tenantId}" && ativa = true`,
      })

      // Débito: Passivo (Obrigações a Recolher) ou do mapeamento
      let contaDebitoId = maps[0]?.conta_debito
      if (!contaDebitoId) {
        const contaObrig =
          contas.find((c) => c.codigo.startsWith('2.1.2') || c.codigo.startsWith('2.1.3')) ||
          contas.find((c) => c.tipo === 'passivo')
        contaDebitoId = contaObrig?.id
      }

      // Crédito: Banco
      let contaCreditoId = maps[0]?.conta_credito
      if (!contaCreditoId) {
        const contaBanco =
          contas.find((c) => c.codigo.startsWith('1.1.1.02')) ||
          contas.find((c) => c.codigo.startsWith('1.1.1')) ||
          contas.find((c) => c.tipo === 'ativo')
        contaCreditoId = contaBanco?.id
      }

      if (contaDebitoId && contaCreditoId) {
        const historico = `Pagamento de retenção ${imposto.tipo.toUpperCase()} comp. ${imposto.competencia} (Guia liquidada)`
        await contabilService.createPartidaDobrada({
          tenant_id: tenantId,
          empresa: empresaId,
          data: now.slice(0, 10),
          competencia: imposto.competencia,
          debitoContaId: contaDebitoId,
          creditoContaId: contaCreditoId,
          valor: imposto.valor,
          historico,
          status: 'confirmado',
          criado_por: usuarioId,
        })
      }
    } catch (errContabil) {
      console.warn('Erro ao gerar partida dobrada do imposto retido:', errContabil)
      // Se a competência estiver fechada, o hook server-side ou service lançará erro
    }

    return updated
  },

  // Pagar lote de impostos retidos
  async pagarLote(
    impostoIds: string[],
    contaBancariaId?: string,
    usuarioId?: string,
  ): Promise<number> {
    let pagos = 0
    for (const id of impostoIds) {
      try {
        await this.pagarImpostoRetido(id, contaBancariaId, usuarioId)
        pagos++
      } catch (e) {
        console.error('Erro ao pagar item do lote de impostos retidos:', id, e)
      }
    }
    return pagos
  },
}

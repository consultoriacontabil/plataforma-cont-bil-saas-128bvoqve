import { contabilService } from '@/services/contabil'
import type { BalanceteItem, DRELinha, BalancoGrupo } from '@/types'

export interface DREResultado {
  linhas: DRELinha[]
  receitaBruta: number
  deducoes: number
  receitaLiquida: number
  custos: number
  lucroBruto: number
  despesasOperacionais: number
  resultadoLiquido: number
}

export interface BalancoResultado {
  ativoTotal: number
  passivoTotal: number
  patrimonioLiquidoTotal: number
  passivoMaisPL: number
  equilibrado: boolean
  diferenca: number
  ativoCirculante: BalancoGrupo['subgrupos'][0]
  ativoNaoCirculante: BalancoGrupo['subgrupos'][0]
  passivoCirculante: BalancoGrupo['subgrupos'][0]
  patrimonioLiquido: BalancoGrupo['subgrupos'][0]
}

export const relatoriosContabeisService = {
  // === Gerar DRE (Demonstração do Resultado do Exercício) a partir do Balancete ===
  // Estrutura padrão brasileira:
  // 1. Receita Operacional Bruta (Vendas / Serviços)
  // 2. (-) Deduções da Receita Bruta (Impostos s/ Vendas, Devoluções, Abatimentos)
  // 3. (=) Receita Operacional Líquida
  // 4. (-) Custos Operacionais / Custo das Mercadorias / Serviços Vendidos
  // 5. (=) Lucro Bruto
  // 6. (-) Despesas Operacionais (Pessoal, Gerais, Tributárias, Depreciação)
  // 7. (=) Resultado Líquido do Exercício (Lucro ou Prejuízo)
  async gerarDRE(tenantId: string, empresaId: string, competencia: string): Promise<DREResultado> {
    const balancete = await contabilService.getBalancete(tenantId, empresaId, competencia)
    const itens = balancete.itens

    // No balancete:
    // tipo = 'receita': saldoAtual reflete receitas creditadas no período
    // tipo = 'despesa': saldoAtual reflete despesas debitadas no período
    // Usamos o movimento do período (debitos - creditos para despesas, creditos - debitos para receitas)

    let receitaBruta = 0
    let deducoes = 0
    let custos = 0
    let despesasOperacionais = 0

    // Listas detalhadas de contas folhas
    const linhasDRE: DRELinha[] = []

    // 1. Receita Bruta (Contas 3.1)
    const contasReceita = itens.filter(
      (i) => i.tipo === 'receita' && !i.isSintetica && i.codigo.startsWith('3'),
    )
    contasReceita.forEach((c) => {
      // Movimento do período da receita: creditos - debitos
      const valor = Math.max(0, c.creditos - c.debitos)
      receitaBruta += valor
    })

    // 2. Deduções (ex: Simples Nacional 4.3.1 ou impostos sobre faturamento)
    const contasDeducoes = itens.filter(
      (i) => !i.isSintetica && (i.codigo.startsWith('4.3') || i.codigo.startsWith('3.2')),
    )
    contasDeducoes.forEach((c) => {
      const valor = Math.max(0, c.debitos - c.creditos)
      deducoes += valor
    })

    const receitaLiquida = receitaBruta - deducoes

    // 3. Custos (se houver grupo 4 com custos específicos ou 4.0)
    const contasCustos = itens.filter(
      (i) =>
        !i.isSintetica && (i.codigo.startsWith('4.0') || i.nome.toLowerCase().includes('custo')),
    )
    contasCustos.forEach((c) => {
      const valor = Math.max(0, c.debitos - c.creditos)
      custos += valor
    })

    const lucroBruto = receitaLiquida - custos

    // 4. Despesas Operacionais (Pessoal 4.1, Administrativas 4.2, Depreciação 4.2.4 etc.)
    // Exceto as contas que já foram classificadas em deduções ou custos
    const contasDespesas = itens.filter((i) => {
      if (i.tipo !== 'despesa' || i.isSintetica) return false
      if (contasDeducoes.some((d) => d.id === i.id)) return false
      if (contasCustos.some((c) => c.id === i.id)) return false
      return true
    })

    contasDespesas.forEach((c) => {
      const valor = Math.max(0, c.debitos - c.creditos)
      despesasOperacionais += valor
    })

    const resultadoLiquido = lucroBruto - despesasOperacionais

    // Montar linhas da DRE estruturada
    linhasDRE.push({
      id: 'dre-rec-bruta-grupo',
      codigo: '1',
      descricao: 'RECEITA OPERACIONAL BRUTA',
      nivel: 1,
      tipo: 'grupo',
      valor: receitaBruta,
      destaque: true,
    })

    contasReceita.forEach((c) => {
      const v = Math.max(0, c.creditos - c.debitos)
      if (v > 0 || c.saldoAtual > 0) {
        linhasDRE.push({
          id: `dre-${c.id}`,
          codigo: c.codigo,
          descricao: c.nome,
          nivel: 2,
          tipo: 'conta',
          valor: v > 0 ? v : c.saldoAtual,
        })
      }
    })

    linhasDRE.push({
      id: 'dre-deducoes-grupo',
      codigo: '2',
      descricao: '(-) DEDUÇÕES DA RECEITA BRUTA E IMPOSTOS S/ VENDAS',
      nivel: 1,
      tipo: 'grupo',
      valor: deducoes,
      negativo: true,
      destaque: true,
    })

    contasDeducoes.forEach((c) => {
      const v = Math.max(0, c.debitos - c.creditos)
      if (v > 0 || c.saldoAtual > 0) {
        linhasDRE.push({
          id: `dre-${c.id}`,
          codigo: c.codigo,
          descricao: `(-) ${c.nome}`,
          nivel: 2,
          tipo: 'conta',
          valor: v > 0 ? v : c.saldoAtual,
          negativo: true,
        })
      }
    })

    linhasDRE.push({
      id: 'dre-rec-liquida',
      codigo: '3',
      descricao: '(=) RECEITA OPERACIONAL LÍQUIDA',
      nivel: 1,
      tipo: 'totalizador',
      valor: receitaLiquida,
      destaque: true,
    })

    if (custos > 0) {
      linhasDRE.push({
        id: 'dre-custos-grupo',
        codigo: '4',
        descricao: '(-) CUSTOS DAS MERCADORIAS E SERVIÇOS PRESTADOS',
        nivel: 1,
        tipo: 'grupo',
        valor: custos,
        negativo: true,
        destaque: true,
      })
      contasCustos.forEach((c) => {
        const v = Math.max(0, c.debitos - c.creditos)
        linhasDRE.push({
          id: `dre-${c.id}`,
          codigo: c.codigo,
          descricao: `(-) ${c.nome}`,
          nivel: 2,
          tipo: 'conta',
          valor: v,
          negativo: true,
        })
      })
    }

    linhasDRE.push({
      id: 'dre-lucro-bruto',
      codigo: '5',
      descricao: '(=) LUCRO BRUTO OPERACIONAL',
      nivel: 1,
      tipo: 'totalizador',
      valor: lucroBruto,
      destaque: true,
    })

    linhasDRE.push({
      id: 'dre-despesas-grupo',
      codigo: '6',
      descricao: '(-) DESPESAS OPERACIONAIS (Gerais, Pessoal e Administrativas)',
      nivel: 1,
      tipo: 'grupo',
      valor: despesasOperacionais,
      negativo: true,
      destaque: true,
    })

    contasDespesas.forEach((c) => {
      const v = Math.max(0, c.debitos - c.creditos)
      if (v > 0 || c.saldoAtual > 0) {
        linhasDRE.push({
          id: `dre-${c.id}`,
          codigo: c.codigo,
          descricao: `(-) ${c.nome}`,
          nivel: 2,
          tipo: 'conta',
          valor: v > 0 ? v : c.saldoAtual,
          negativo: true,
        })
      }
    })

    linhasDRE.push({
      id: 'dre-resultado-liquido',
      codigo: '7',
      descricao:
        resultadoLiquido >= 0
          ? '(=) RESULTADO LÍQUIDO DO EXERCÍCIO (LUCRO)'
          : '(=) RESULTADO LÍQUIDO DO EXERCÍCIO (PREJUÍZO)',
      nivel: 1,
      tipo: 'resultado',
      valor: resultadoLiquido,
      destaque: true,
      negativo: resultadoLiquido < 0,
    })

    return {
      linhas: linhasDRE,
      receitaBruta,
      deducoes,
      receitaLiquida,
      custos,
      lucroBruto,
      despesasOperacionais,
      resultadoLiquido,
    }
  },

  // === Gerar Balanço Patrimonial a partir do Balancete ===
  // Ativo = Ativo Circulante + Ativo Não Circulante
  // Passivo = Passivo Circulante + Passivo Não Circulante
  // Patrimônio Líquido = Capital + Reservas/Resultados
  // Verificação Ativo = Passivo + PL
  async gerarBalancoPatrimonial(
    tenantId: string,
    empresaId: string,
    competencia: string,
  ): Promise<BalancoResultado> {
    const balancete = await contabilService.getBalancete(tenantId, empresaId, competencia)
    const itens = balancete.itens

    // Subgrupos
    const ativoCirculante = {
      nome: 'Ativo Circulante',
      codigo: '1.1',
      saldo: 0,
      contas: [] as { codigo: string; nome: string; saldo: number }[],
    }

    const ativoNaoCirculante = {
      nome: 'Ativo Não Circulante (Imobilizado)',
      codigo: '1.2',
      saldo: 0,
      contas: [] as { codigo: string; nome: string; saldo: number }[],
    }

    const passivoCirculante = {
      nome: 'Passivo Circulante',
      codigo: '2.1',
      saldo: 0,
      contas: [] as { codigo: string; nome: string; saldo: number }[],
    }

    const patrimonioLiquido = {
      nome: 'Patrimônio Líquido',
      codigo: '2.2',
      saldo: 0,
      contas: [] as { codigo: string; nome: string; saldo: number }[],
    }

    // Distribuir as contas analíticas
    itens.forEach((it) => {
      if (it.isSintetica) return
      const saldo = it.saldoAtual

      if (it.codigo.startsWith('1.1')) {
        ativoCirculante.contas.push({
          codigo: it.codigo,
          nome: it.nome,
          saldo,
        })
        ativoCirculante.saldo += saldo
      } else if (it.codigo.startsWith('1.2')) {
        ativoNaoCirculante.contas.push({
          codigo: it.codigo,
          nome: it.nome,
          saldo,
        })
        ativoNaoCirculante.saldo += saldo
      } else if (it.codigo.startsWith('2.1')) {
        passivoCirculante.contas.push({
          codigo: it.codigo,
          nome: it.nome,
          saldo,
        })
        passivoCirculante.saldo += saldo
      } else if (it.codigo.startsWith('2.2') || it.tipo === 'patrimonio') {
        patrimonioLiquido.contas.push({
          codigo: it.codigo,
          nome: it.nome,
          saldo,
        })
        patrimonioLiquido.saldo += saldo
      }
    })

    const ativoTotal = Math.round((ativoCirculante.saldo + ativoNaoCirculante.saldo) * 100) / 100
    const passivoTotal = Math.round(passivoCirculante.saldo * 100) / 100
    const patrimonioLiquidoTotal = Math.round(patrimonioLiquido.saldo * 100) / 100
    const passivoMaisPL = Math.round((passivoTotal + patrimonioLiquidoTotal) * 100) / 100
    const diferenca = Math.round(Math.abs(ativoTotal - passivoMaisPL) * 100) / 100
    const equilibrado = diferenca < 0.05

    return {
      ativoTotal,
      passivoTotal,
      patrimonioLiquidoTotal,
      passivoMaisPL,
      equilibrado,
      diferenca,
      ativoCirculante,
      ativoNaoCirculante,
      passivoCirculante,
      patrimonioLiquido,
    }
  },
}

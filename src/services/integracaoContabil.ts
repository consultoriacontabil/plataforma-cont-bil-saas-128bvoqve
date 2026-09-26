import pb from '@/lib/pocketbase/client'
import { contabilService } from '@/services/contabil'
import { auditService } from '@/services/audit'
import type { ContaContabil, LancamentoContabil } from '@/types'

export interface GerarLoteFolhaResult {
  loteId: string
  totalLancamentos: number
  totalDebito: number
  totalCredito: number
  competenciaFechada: boolean
  avisos?: string[]
}

export interface GerarLancamentoApuracaoTributoInput {
  tenantId: string
  empresaId: string
  competencia: string
  tipoGuia: 'das' | 'darf' | 'iss' | 'darf_previdenciario' | 'dctfweb'
  valorTotal: number
  dataApuracao?: string
  descricao?: string
  numeroGuia?: string
  usuarioId?: string
}

export interface GerarLancamentoLiquidacaoGuiaInput {
  tenantId: string
  empresaId: string
  competencia: string
  tipoGuia: string
  valorPago: number
  dataPagamento: string
  bancoContaId?: string
  autenticacao?: string
  guiaId?: string
  usuarioId?: string
}

export const integracaoContabilService = {
  /**
   * Localiza contas no plano de contas pelo código ou nome correspondente.
   */
  async findContasPadrao(tenantId: string) {
    const contas = await pb.collection('plano_contas').getFullList<ContaContabil>({
      filter: `tenant_id = "${tenantId}" && ativa = true`,
    })

    const byCodigo = new Map<string, ContaContabil>()
    for (const c of contas) {
      byCodigo.set(c.codigo, c)
    }

    // Helper de busca por código ou fallback por similaridade de nome/tipo
    const findByCodOrName = (codigoPreferido: string, fallbackKeywords: string[], tipo: string) => {
      if (byCodigo.has(codigoPreferido)) {
        return byCodigo.get(codigoPreferido)!
      }
      // Procura com prefixo de código
      const porPrefixo = contas.find((c) => c.codigo.startsWith(codigoPreferido))
      if (porPrefixo) return porPrefixo

      // Fallback por palavra-chave no nome
      const porNome = contas.find(
        (c) =>
          c.tipo === tipo &&
          fallbackKeywords.some((kw) => c.nome.toLowerCase().includes(kw.toLowerCase())),
      )
      return porNome || null
    }

    // 4.1.1 - Salários / Férias / 13º (Despesa com Pessoal)
    const contaDespSalarios = findByCodOrName(
      '4.1.1',
      ['Salários', 'Salario', 'Remuneração', 'Pessoal'],
      'despesa',
    )
    // 4.1.2 - Encargos Sociais (FGTS e Previdência - Despesa)
    const contaDespEncargos = findByCodOrName(
      '4.1.2',
      ['Encargos Sociais', 'FGTS', 'Previdência', 'INSS Patronal'],
      'despesa',
    )
    // 4.3.1 - Simples Nacional / Tributos sobre Faturamento (Despesa)
    const contaDespTributos = findByCodOrName(
      '4.3.1',
      ['Simples Nacional', 'DAS', 'Tributos', 'Impostos'],
      'despesa',
    )
    // 2.1.3.01 - Salários a Pagar (Passivo)
    const contaSalariosPagar = findByCodOrName(
      '2.1.3.01',
      ['Salários a Pagar', 'Ordenados', 'Folha'],
      'passivo',
    )
    // 2.1.3.02 - Encargos a Recolher / FGTS a Recolher (Passivo)
    const contaEncargosRecolher = findByCodOrName(
      '2.1.3.02',
      ['Encargos a Recolher', 'FGTS a Recolher', 'Previdência a Recolher'],
      'passivo',
    )
    // 2.1.2.01 - Impostos a Recolher / Tributos a Recolher (Passivo)
    const contaImpostosRecolher = findByCodOrName(
      '2.1.2.01',
      ['Impostos a Recolher', 'Tributos a Recolher', 'Simples a Recolher', 'DARF', 'DAS'],
      'passivo',
    )
    // 1.1.1.02 - Bancos Conta Movimento (Ativo)
    const contaBanco = findByCodOrName('1.1.1.02', ['Banco', 'Bancos'], 'ativo')

    return {
      contaDespSalarios,
      contaDespEncargos: contaDespEncargos || contaDespSalarios,
      contaDespTributos,
      contaSalariosPagar,
      contaEncargosRecolher: contaEncargosRecolher || contaSalariosPagar,
      contaImpostosRecolher,
      contaBanco,
    }
  },

  /**
   * Verifica se a competência contábil está formalmente fechada para a empresa.
   */
  async isCompetenciaFechada(
    tenantId: string,
    empresaId: string,
    competencia: string,
  ): Promise<boolean> {
    try {
      const fechamentos = await pb.collection('fechamento_competencia').getFullList({
        filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}" && status = "fechado"`,
      })
      return fechamentos.length > 0
    } catch {
      return false
    }
  },

  /**
   * 1. LOTE CONTÁBIL AUTOMÁTICO DA FOLHA DE PAGAMENTO (Partidas Dobradas D = C)
   * Gera:
   * - Provisão de Salários: D (4.1.1 Despesa Salários) / C (2.1.3.01 Salários a Pagar)
   * - INSS Retido de Colaboradores: D (4.1.1 Despesa Salários) / C (2.1.2.01 Impostos a Recolher ou 2.1.3.02)
   * - IRRF Retido s/ Salários: D (4.1.1 Despesa Salários) / C (2.1.2.01 Impostos a Recolher)
   * - Encargos Patronais / FGTS (8%): D (4.1.2 Despesas de Encargos) / C (2.1.3.02 Encargos a Recolher)
   *
   * Se a competência contábil estiver fechada:
   * Política de honestidade técnica — NÃO aborta a folha; registra pendência no audit_log.
   */
  async gerarLoteContabilFolha(params: {
    tenantId: string
    empresaId: string
    competencia: string
    usuarioId?: string
    dataLancamento?: string
  }): Promise<GerarLoteFolhaResult> {
    const { tenantId, empresaId, competencia, usuarioId } = params

    // 1. Verificar se a competência contábil está fechada
    const fechada = await this.isCompetenciaFechada(tenantId, empresaId, competencia)
    if (fechada) {
      await auditService.log({
        tenant_id: tenantId,
        usuario_id: usuarioId,
        acao: 'bloqueio_lote_folha_competencia_fechada',
        entidade: 'fechamento_competencia',
        entidade_id: `${empresaId}-${competencia}`,
        detalhes: `Tentativa de geração automática de lote contábil da folha bloqueada: competência ${competencia} está formalmente encerrada na empresa. Registrada pendência de reabertura para integração contábil.`,
      })
      return {
        loteId: '',
        totalLancamentos: 0,
        totalDebito: 0,
        totalCredito: 0,
        competenciaFechada: true,
        avisos: [
          `Competência contábil ${competencia} está formalmente fechada. O lote da folha foi registrado como pendência para preservar a integridade contábil.`,
        ],
      }
    }

    // 2. Buscar registros da folha desta empresa/competência
    const folhas = await pb.collection('folha_pagamento').getFullList({
      filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`,
    })

    if (folhas.length === 0) {
      return {
        loteId: '',
        totalLancamentos: 0,
        totalDebito: 0,
        totalCredito: 0,
        competenciaFechada: false,
        avisos: [`Nenhum holerite encontrado na competência ${competencia} para contabilização.`],
      }
    }

    // 3. Localizar contas contábeis correspondentes
    const contas = await this.findContasPadrao(tenantId)
    if (!contas.contaDespSalarios || !contas.contaSalariosPagar || !contas.contaImpostosRecolher) {
      throw new Error(
        'Plano de contas incompleto para provisão da folha. Certifique-se de que contas de Despesa com Pessoal (4.1.1), Salários a Pagar (2.1.3.01) e Impostos/Encargos a Recolher (2.1.2.01 / 2.1.3.02) estão ativas no plano de contas.',
      )
    }

    // Somatórios da folha
    let somaBruto = 0
    let somaInss = 0
    let somaIrrf = 0
    let somaFgts = 0
    let somaLiquido = 0

    for (const f of folhas) {
      let b = Number(f.salario_base) || 0
      if (f.proventos) {
        try {
          const arr = typeof f.proventos === 'string' ? JSON.parse(f.proventos) : f.proventos
          if (Array.isArray(arr) && arr.length > 0) {
            b = arr.reduce(
              (acc: number, cur: { valor?: number }) => acc + (Number(cur.valor) || 0),
              0,
            )
          }
        } catch {
          /* ignore */
        }
      }
      somaBruto += b
      somaInss += Number(f.inss) || 0
      somaIrrf += Number(f.irrf) || 0
      somaFgts += Number(f.fgts) || 0
      somaLiquido += Number(f.total_liquido) || 0
    }

    // Lote id para rastreio unificado
    const loteId = `LOTE-FOLHA-${competencia.replace('/', '')}-${Date.now().toString(36)}`
    const dataRef = params.dataLancamento || new Date().toISOString()
    let totalLancamentos = 0
    let totalDebito = 0
    let totalCredito = 0

    // Partida 1: Salários Líquidos a Pagar
    if (somaLiquido > 0) {
      const part1 = await contabilService.createPartidaDobrada({
        tenant_id: tenantId,
        empresa: empresaId,
        competencia,
        data: dataRef,
        valor: Math.round(somaLiquido * 100) / 100,
        historico: `Provisão de Salários Líquidos ref. folha de pagamento competência ${competencia}`,
        debitoContaId: contas.contaDespSalarios.id,
        creditoContaId: contas.contaSalariosPagar.id,
        status: 'confirmado',
        loteId,
        origem: 'folha',
        criado_por: usuarioId,
      })
      if (part1) {
        totalLancamentos += 2
        totalDebito += Math.round(somaLiquido * 100) / 100
        totalCredito += Math.round(somaLiquido * 100) / 100
      }
    }

    // Partida 2: INSS Retido dos Colaboradores
    if (somaInss > 0) {
      const contaCredInss = contas.contaEncargosRecolher || contas.contaImpostosRecolher
      const part2 = await contabilService.createPartidaDobrada({
        tenant_id: tenantId,
        empresa: empresaId,
        competencia,
        data: dataRef,
        valor: Math.round(somaInss * 100) / 100,
        historico: `Provisão de INSS retido dos colaboradores conf. folha de pagamento ${competencia}`,
        debitoContaId: contas.contaDespSalarios.id,
        creditoContaId: contaCredInss.id,
        status: 'confirmado',
        loteId,
        origem: 'folha',
        criado_por: usuarioId,
      })
      if (part2) {
        totalLancamentos += 2
        totalDebito += Math.round(somaInss * 100) / 100
        totalCredito += Math.round(somaInss * 100) / 100
      }
    }

    // Partida 3: IRRF Retido s/ Folha
    if (somaIrrf > 0) {
      const part3 = await contabilService.createPartidaDobrada({
        tenant_id: tenantId,
        empresa: empresaId,
        competencia,
        data: dataRef,
        valor: Math.round(somaIrrf * 100) / 100,
        historico: `Provisão de IRRF retido s/ rendimentos da folha competência ${competencia}`,
        debitoContaId: contas.contaDespSalarios.id,
        creditoContaId: contas.contaImpostosRecolher.id,
        status: 'confirmado',
        loteId,
        origem: 'folha',
        criado_por: usuarioId,
      })
      if (part3) {
        totalLancamentos += 2
        totalDebito += Math.round(somaIrrf * 100) / 100
        totalCredito += Math.round(somaIrrf * 100) / 100
      }
    }

    // Partida 4: FGTS Provisão Patronal (8%)
    if (somaFgts > 0) {
      const contaDespFgts = contas.contaDespEncargos || contas.contaDespSalarios
      const contaCredFgts = contas.contaEncargosRecolher || contas.contaImpostosRecolher
      const part4 = await contabilService.createPartidaDobrada({
        tenant_id: tenantId,
        empresa: empresaId,
        competencia,
        data: dataRef,
        valor: Math.round(somaFgts * 100) / 100,
        historico: `Provisão de FGTS patronal (8%) s/ remunerações da folha comp. ${competencia}`,
        debitoContaId: contaDespFgts.id,
        creditoContaId: contaCredFgts.id,
        status: 'confirmado',
        loteId,
        origem: 'folha',
        criado_por: usuarioId,
      })
      if (part4) {
        totalLancamentos += 2
        totalDebito += Math.round(somaFgts * 100) / 100
        totalCredito += Math.round(somaFgts * 100) / 100
      }
    }

    // Auditoria da geração do lote
    await auditService.log({
      tenant_id: tenantId,
      usuario_id: usuarioId,
      acao: 'gerar_lote_contabil_folha_automatico',
      entidade: 'lancamentos_contabeis',
      entidade_id: loteId,
      detalhes: `Lote de partidas dobradas ${loteId} gerado automaticamente da folha de pagamento ${competencia} (${folhas.length} holerites). Total Débito: R$ ${totalDebito.toFixed(2)}, Total Crédito: R$ ${totalCredito.toFixed(2)}. Origem: folha.`,
    })

    return {
      loteId,
      totalLancamentos,
      totalDebito,
      totalCredito,
      competenciaFechada: false,
    }
  },

  /**
   * 2. CASCATA FISCAL → CONTÁBIL: APURAÇÃO DE TRIBUTO (DAS / DARF / ISS)
   * Provisão do tributo: D (Despesa Tributária 4.3.1) / C (Passivo Tributos a Recolher 2.1.2.01)
   */
  async gerarLancamentoApuracaoTributo(
    input: GerarLancamentoApuracaoTributoInput,
  ): Promise<{ loteId: string; sucesso: boolean; bloqueadoFechamento?: boolean }> {
    const { tenantId, empresaId, competencia, tipoGuia, valorTotal, usuarioId } = input

    // 1. Validação de competência fechada
    const fechada = await this.isCompetenciaFechada(tenantId, empresaId, competencia)
    if (fechada) {
      await auditService.log({
        tenant_id: tenantId,
        usuario_id: usuarioId,
        acao: 'bloqueio_apuracao_fiscal_competencia_fechada',
        entidade: 'fechamento_competencia',
        entidade_id: `${empresaId}-${competencia}`,
        detalhes: `Lançamento contábil de apuração fiscal (${tipoGuia.toUpperCase()}) bloqueado: competência ${competencia} está fechada.`,
      })
      return { loteId: '', sucesso: false, bloqueadoFechamento: true }
    }

    if (!valorTotal || valorTotal <= 0) {
      return { loteId: '', sucesso: false }
    }

    // 2. Buscar contas padrão
    const contas = await this.findContasPadrao(tenantId)
    if (!contas.contaDespTributos || !contas.contaImpostosRecolher) {
      throw new Error(
        'Plano de contas sem contas ativas para tributos (4.3.1 Despesas Tributárias e 2.1.2.01 Impostos a Recolher).',
      )
    }

    const loteId = `LOTE-FISC-${tipoGuia.toUpperCase()}-${competencia.replace('/', '')}-${Date.now().toString(36)}`
    const desc =
      input.descricao ||
      `Provisão tributária apurada de ${tipoGuia.toUpperCase()} ref. competência ${competencia}`

    await contabilService.createPartidaDobrada({
      tenant_id: tenantId,
      empresa: empresaId,
      competencia,
      data: input.dataApuracao || new Date().toISOString(),
      valor: Math.round(valorTotal * 100) / 100,
      historico: desc,
      debitoContaId: contas.contaDespTributos.id,
      creditoContaId: contas.contaImpostosRecolher.id,
      status: 'confirmado',
      loteId,
      origem: 'fiscal',
      criado_por: usuarioId,
    })

    await auditService.log({
      tenant_id: tenantId,
      usuario_id: usuarioId,
      acao: 'gerar_lancamento_apuracao_fiscal',
      entidade: 'lancamentos_contabeis',
      entidade_id: loteId,
      detalhes: `Provisão de tributo ${tipoGuia.toUpperCase()} comp. ${competencia} no valor de R$ ${valorTotal.toFixed(2)} gerada com origem fiscal (lote: ${loteId}).`,
    })

    return { loteId, sucesso: true }
  },

  /**
   * 2b. CASCATA FISCAL → CONTÁBIL: LIQUIDAÇÃO DE GUIA (Baixa e-CAC / Modo Supervisão)
   * Baixa da guia no contábil: D (Passivo Tributos a Recolher 2.1.2.01) / C (Ativo Banco 1.1.1.02)
   */
  async gerarLancamentoLiquidacaoGuia(
    input: GerarLancamentoLiquidacaoGuiaInput,
  ): Promise<{ loteId: string; sucesso: boolean; bloqueadoFechamento?: boolean }> {
    const { tenantId, empresaId, competencia, tipoGuia, valorPago, usuarioId } = input

    // 1. Validação de competência fechada
    const fechada = await this.isCompetenciaFechada(tenantId, empresaId, competencia)
    if (fechada) {
      await auditService.log({
        tenant_id: tenantId,
        usuario_id: usuarioId,
        acao: 'bloqueio_liquidacao_guia_competencia_fechada',
        entidade: 'fechamento_competencia',
        entidade_id: `${empresaId}-${competencia}`,
        detalhes: `Lançamento de liquidação da guia ${tipoGuia.toUpperCase()} bloqueado: competência ${competencia} está fechada.`,
      })
      return { loteId: '', sucesso: false, bloqueadoFechamento: true }
    }

    if (!valorPago || valorPago <= 0) {
      return { loteId: '', sucesso: false }
    }

    const contas = await this.findContasPadrao(tenantId)
    if (!contas.contaImpostosRecolher || !contas.contaBanco) {
      throw new Error(
        'Plano de contas sem contas ativas para liquidação de guia (2.1.2.01 Impostos a Recolher e 1.1.1.02 Banco Movimento).',
      )
    }

    const loteId = `LOTE-LIQ-${tipoGuia.toUpperCase()}-${competencia.replace('/', '')}-${Date.now().toString(36)}`
    const autInfo = input.autenticacao ? ` Autenticação: ${input.autenticacao}.` : ''
    const historico = `Liquidação/Pagamento da guia ${tipoGuia.toUpperCase()} competência ${competencia} via baixa assistida e-CAC.${autInfo}`

    await contabilService.createPartidaDobrada({
      tenant_id: tenantId,
      empresa: empresaId,
      competencia,
      data: input.dataPagamento || new Date().toISOString(),
      valor: Math.round(valorPago * 100) / 100,
      historico,
      debitoContaId: contas.contaImpostosRecolher.id,
      creditoContaId: contas.contaBanco.id,
      status: 'confirmado',
      loteId,
      origem: 'fiscal',
      criado_por: usuarioId,
    })

    await auditService.log({
      tenant_id: tenantId,
      usuario_id: usuarioId,
      acao: 'gerar_lancamento_liquidacao_guia_fiscal',
      entidade: 'lancamentos_contabeis',
      entidade_id: loteId,
      detalhes: `Liquidação contábil da guia ${tipoGuia.toUpperCase()} comp. ${competencia} no valor de R$ ${valorPago.toFixed(2)} confirmada (lote: ${loteId}). Origem: fiscal.`,
    })

    return { loteId, sucesso: true }
  },

  /**
   * 3. DIAGNÓSTICO DO TRIPÉ INTEGRADO (Folha → Fiscal → Contábil → Obrigações)
   * Avalia os 4 elos para cada empresa e competência:
   *  1. Folha Processada?
   *  2. Tributos Apurados? (DAS/DARF/ISS)
   *  3. Lançamentos Contábeis Confirmados? (Origens folha e fiscal balanceadas)
   *  4. Obrigações Transmitidas? (Modo Supervisão / DCTF / eSocial / EFD)
   */
  async obterDiagnosticoTripe(tenantId: string, empresaId: string, competencia: string) {
    const [folhas, guias, lancamentos, obrigacoes, fechamentos] = await Promise.all([
      pb.collection('folha_pagamento').getFullList({
        filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`,
      }),
      pb.collection('guias_pagamentos').getFullList({
        filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && periodo_apuracao = "${competencia}"`,
      }),
      pb.collection('lancamentos_contabeis').getFullList<LancamentoContabil>({
        filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`,
      }),
      pb.collection('obrigacoes').getFullList({
        filter: `tenant_id = "${tenantId}" && empresa_id = "${empresaId}" && competencia = "${competencia}"`,
      }),
      pb.collection('fechamento_competencia').getFullList({
        filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`,
      }),
    ])

    const compFechada = fechamentos.some((f) => f.status === 'fechado')

    // 1. Etapa Folha
    const totalHolerites = folhas.length
    const holeritesProcessados = folhas.filter(
      (f) => f.status === 'processada' || f.status === 'paga',
    ).length
    const folhaTotalLiquido = folhas.reduce((acc, f) => acc + (Number(f.total_liquido) || 0), 0)
    const folhaConcluida = totalHolerites > 0 && holeritesProcessados === totalHolerites

    // 2. Etapa Fiscal (Tributos Apurados)
    const totalGuias = guias.length
    const guiasPagas = guias.filter((g) => g.situacao === 'paga').length
    const totalTributosValor = guias.reduce((acc, g) => acc + (Number(g.valor_total) || 0), 0)
    const fiscalConcluido = totalGuias > 0

    // 3. Etapa Contábil (Lançamentos confirmados)
    const lancamentosConfirmados = lancamentos.filter((l) => l.status === 'confirmado')
    const lancamentosFolha = lancamentos.filter(
      (l) =>
        l.origem === 'folha' ||
        l.historico.toLowerCase().includes('folha') ||
        l.historico.toLowerCase().includes('salário'),
    )
    const lancamentosFiscal = lancamentos.filter(
      (l) =>
        l.origem === 'fiscal' ||
        l.historico.toLowerCase().includes('simples') ||
        l.historico.toLowerCase().includes('guia') ||
        l.historico.toLowerCase().includes('tribut'),
    )

    const temLoteFolha = lancamentosFolha.length > 0
    const temLoteFiscal = lancamentosFiscal.length > 0
    const contabilConcluido =
      lancamentosConfirmados.length >= 2 &&
      (!folhaConcluida || temLoteFolha) &&
      (!fiscalConcluido || temLoteFiscal)

    // 4. Etapa Obrigações (Transmitidas)
    const totalObrigacoes = obrigacoes.length
    const obrigacoesTransmitidas = obrigacoes.filter((o) => o.status === 'entregue').length
    const obrigacoesConcluidas = totalObrigacoes > 0 && obrigacoesTransmitidas === totalObrigacoes

    // Identificar elo quebrado (alerta principal)
    let eloQuebrado: string | null = null
    let acaoSugerida:
      | 'gerar_folha'
      | 'gerar_lote_folha'
      | 'apurar_tributo'
      | 'gerar_lote_fiscal'
      | 'transmitir_obrigacao'
      | 'liquidar_guia'
      | null = null

    if (totalHolerites === 0) {
      eloQuebrado = 'Folha de pagamento não foi processada para esta competência.'
      acaoSugerida = 'gerar_folha'
    } else if (folhaConcluida && !temLoteFolha) {
      eloQuebrado =
        'Elo quebrado: Folha processada mas lote contábil correspondente não foi gerado.'
      acaoSugerida = 'gerar_lote_folha'
    } else if (totalGuias === 0) {
      eloQuebrado = 'Elo quebrado: Nenhuma apuração fiscal/guia de tributo (DAS/DARF) emitida.'
      acaoSugerida = 'apurar_tributo'
    } else if (fiscalConcluido && !temLoteFiscal) {
      eloQuebrado =
        'Elo quebrado: Guia fiscal apurada porém lançamento contábil de provisão ausente.'
      acaoSugerida = 'gerar_lote_fiscal'
    } else if (guias.some((g) => g.situacao === 'pendente' || g.situacao === 'vencida')) {
      eloQuebrado = 'Guia tributária pendente de liquidação assistida / conciliação e-CAC.'
      acaoSugerida = 'liquidar_guia'
    } else if (totalObrigacoes > 0 && !obrigacoesConcluidas) {
      eloQuebrado = 'Elo quebrado: Obrigações acessórias pendentes de transmissão oficial.'
      acaoSugerida = 'transmitir_obrigacao'
    }

    return {
      empresaId,
      competencia,
      competenciaFechada: compFechada,
      etapaFolha: {
        concluida: folhaConcluida,
        totalHolerites,
        holeritesProcessados,
        totalLiquido: folhaTotalLiquido,
        temLoteContabil: temLoteFolha,
      },
      etapaFiscal: {
        concluida: fiscalConcluido,
        totalGuias,
        guiasPagas,
        totalValor: totalTributosValor,
        temLoteContabil: temLoteFiscal,
      },
      etapaContabil: {
        concluida: contabilConcluido,
        totalLancamentos: lancamentos.length,
        confirmados: lancamentosConfirmados.length,
        lancamentosFolha: lancamentosFolha.length,
        lancamentosFiscal: lancamentosFiscal.length,
      },
      etapaObrigacoes: {
        concluida: obrigacoesConcluidas,
        totalObrigacoes,
        transmitidas: obrigacoesTransmitidas,
      },
      eloQuebrado,
      acaoSugerida,
    }
  },
}

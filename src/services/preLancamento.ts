import pb from '@/lib/pocketbase/client'
import { contabilService } from '@/services/contabil'
import type {
  PreLancamentoRecord,
  PreLancamentoStatus,
  AnalisarDocumentosResultado,
  Documento,
  ContaContabil,
  MapeamentoContabil,
} from '@/types'

export interface ListPreLancamentosFilters {
  empresaId?: string
  competencia?: string
  status?: string
  confiancaMinima?: number
  busca?: string
}

export const preLancamentoService = {
  // === Listagem de Sugestões de Pré-Lançamento ===
  async list(tenantId: string, filters?: ListPreLancamentosFilters) {
    const filterParts: string[] = [`tenant_id = "${tenantId}"`]

    if (filters?.empresaId && filters.empresaId !== 'todas') {
      filterParts.push(`empresa = "${filters.empresaId}"`)
    }
    if (filters?.competencia && filters.competencia !== 'todas') {
      filterParts.push(`competencia = "${filters.competencia}"`)
    }
    if (filters?.status && filters.status !== 'todos') {
      filterParts.push(`status = "${filters.status}"`)
    }
    if (filters?.confiancaMinima && filters.confiancaMinima > 0) {
      filterParts.push(`confianca >= ${filters.confiancaMinima}`)
    }
    if (filters?.busca && filters.busca.trim()) {
      filterParts.push(`historico_sugerido ~ "${filters.busca.trim()}"`)
    }

    const filter = filterParts.join(' && ')

    return pb.collection('pre_lancamentos').getFullList<PreLancamentoRecord>({
      filter,
      sort: '-confianca,-created',
      expand: 'empresa,documento,debito_sugerido,credito_sugerido,processado_por',
    })
  },

  async getById(id: string) {
    return pb.collection('pre_lancamentos').getOne<PreLancamentoRecord>(id, {
      expand: 'empresa,documento,debito_sugerido,credito_sugerido,processado_por',
    })
  },

  // === Atualizar / Editar Sugestão (revisão de contas/valor/histórico antes de aceitar) ===
  async update(
    id: string,
    data: Partial<{
      debito_sugerido: string
      credito_sugerido: string
      valor_sugerido: number
      historico_sugerido: string
      competencia: string
    }>,
  ) {
    return pb.collection('pre_lancamentos').update<PreLancamentoRecord>(id, data, {
      expand: 'empresa,documento,debito_sugerido,credito_sugerido,processado_por',
    })
  },

  // === Rejeitar Sugestão (Auxiliar, Contador, Administrador) ===
  async rejeitar(id: string, motivo?: string, usuarioId?: string) {
    return pb.collection('pre_lancamentos').update<PreLancamentoRecord>(
      id,
      {
        status: 'rejeitado',
        motivo_rejeicao: motivo || 'Rejeitado pelo operador',
        data_processamento: new Date().toISOString(),
        processado_por: usuarioId || null,
      },
      {
        expand: 'empresa,documento,debito_sugerido,credito_sugerido,processado_por',
      },
    )
  },

  // === Aceitar Sugestão e Converter em Lançamento Real (Partida Dobrada) ===
  // Respeita bloqueio de competência fechada e anti-duplicidade
  async aceitar(
    preLancamentoId: string,
    usuarioId: string,
    dadosRevisados?: {
      debitoContaId?: string
      creditoContaId?: string
      valor?: number
      historico?: string
      competencia?: string
    },
  ) {
    const pre = await this.getById(preLancamentoId)

    if (pre.status === 'convertido') {
      throw new Error('Esta sugestão de pré-lançamento já foi convertida em lançamento contábil.')
    }

    const competencia = dadosRevisados?.competencia || pre.competencia
    const debitoId = dadosRevisados?.debitoContaId || pre.debito_sugerido
    const creditoId = dadosRevisados?.creditoContaId || pre.credito_sugerido
    const valor = dadosRevisados?.valor !== undefined ? dadosRevisados.valor : pre.valor_sugerido
    const historico = dadosRevisados?.historico || pre.historico_sugerido

    if (!debitoId || !creditoId) {
      throw new Error(
        'Selecione as contas de Débito e Crédito para efetivar a partida dobrada do lançamento.',
      )
    }

    if (debitoId === creditoId) {
      throw new Error('As contas de débito e crédito devem ser distintas na partida dobrada.')
    }

    if (valor <= 0) {
      throw new Error('O valor do lançamento deve ser maior que zero.')
    }

    // 1. Validar se a competência já está oficialmente fechada para a empresa
    const fechamentos = await pb.collection('fechamento_competencia').getFullList({
      filter: `tenant_id = "${pre.tenant_id}" && empresa = "${pre.empresa}" && competencia = "${competencia}" && status = "fechado"`,
    })

    if (fechamentos.length > 0) {
      throw new Error(
        `A competência ${competencia} está fechada e bloqueada para a empresa. Reabra o período no Fecho Mensal para efetivar novos lançamentos.`,
      )
    }

    // 2. Anti-duplicidade: verificar se já existe lançamento com o mesmo lote gerado
    const loteId = pre.lote_id || `LOTE-PRE-${pre.id}`
    const existentes = await pb.collection('lancamentos_contabeis').getFullList({
      filter: `tenant_id = "${pre.tenant_id}" && lote_id = "${loteId}"`,
    })

    if (existentes.length > 0) {
      throw new Error('Já existem lançamentos contábeis registrados para este lote.')
    }

    // 3. Gerar a partida dobrada real na coleção lancamentos_contabeis
    const dataHoje = new Date().toISOString()
    const loteGerado = `LOTE-PRE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    // Débito
    await pb.collection('lancamentos_contabeis').create({
      tenant_id: pre.tenant_id,
      empresa: pre.empresa,
      data: dataHoje,
      tipo: 'debito',
      conta_contabil: debitoId,
      contrapartida: creditoId,
      valor,
      historico: `${historico} (Origem: Pré-lançamento GED)`,
      documento: pre.documento || undefined,
      competencia,
      status: 'confirmado',
      lote_id: loteGerado,
      criado_por: usuarioId,
    })

    // Crédito
    await pb.collection('lancamentos_contabeis').create({
      tenant_id: pre.tenant_id,
      empresa: pre.empresa,
      data: dataHoje,
      tipo: 'credito',
      conta_contabil: creditoId,
      contrapartida: debitoId,
      valor,
      historico: `${historico} (Origem: Pré-lançamento GED)`,
      documento: pre.documento || undefined,
      competencia,
      status: 'confirmado',
      lote_id: loteGerado,
      criado_por: usuarioId,
    })

    // 4. Atualizar o pré-lançamento para convertido
    return pb.collection('pre_lancamentos').update<PreLancamentoRecord>(
      pre.id,
      {
        status: 'convertido',
        lote_id: loteGerado,
        debito_sugerido: debitoId,
        credito_sugerido: creditoId,
        valor_sugerido: valor,
        historico_sugerido: historico,
        competencia,
        data_processamento: dataHoje,
        processado_por: usuarioId,
      },
      {
        expand: 'empresa,documento,debito_sugerido,credito_sugerido,processado_por',
      },
    )
  },

  // === Motor de Sugestão Automática a partir de Documentos Classificados ===
  // Analisa documentos do GED (tipo, observações, nome_arquivo) e sugere partidas dobradas
  async analisarDocumentosPendentes(
    tenantId: string,
    empresaId?: string,
    competenciaAlvo?: string,
  ): Promise<AnalisarDocumentosResultado> {
    const compPadrao = competenciaAlvo || '09/2026'

    // 1. Obter mapeamentos contábeis de documentos configurados no escritório
    const mapeamentos = await pb.collection('mapeamento_contabil').getFullList<MapeamentoContabil>({
      filter: `tenant_id = "${tenantId}"`,
      expand: 'conta_debito,conta_credito',
    })

    const mapDocs = new Map<string, MapeamentoContabil>()
    mapeamentos.forEach((m) => {
      mapDocs.set(m.chave.toLowerCase(), m)
    })

    // 2. Obter plano de contas ativo para inferências de fallback
    const contas = await contabilService.getPlanoContas(tenantId, 'ativa = true')
    const contasByCod = new Map<string, ContaContabil>()
    contas.forEach((c) => contasByCod.set(c.codigo, c))

    const contaBanco = contasByCod.get('1.1.1.02')
    const contaClientes = contasByCod.get('1.1.2.01')
    const contaFornecedores = contasByCod.get('2.1.1.01')
    const contaRecServicos = contasByCod.get('3.1.1')
    const contaRecVendas = contasByCod.get('3.1.2')
    const contaDespServicos = contasByCod.get('4.2.3')
    const contaDespEnergia = contasByCod.get('4.2.2')
    const contaDespSimples = contasByCod.get('4.3.1')
    const contaSimplesPassivo = contasByCod.get('2.1.2.01')
    const contaDespSalarios = contasByCod.get('4.1.1')
    const contaSalariosPassivo = contasByCod.get('2.1.3.01')

    // 3. Buscar documentos
    let docFilter = `tenant_id = "${tenantId}"`
    if (empresaId && empresaId !== 'todas') {
      docFilter += ` && empresa_id = "${empresaId}"`
    }
    const docs = await pb.collection('documentos').getFullList<Documento>({
      filter: docFilter,
      sort: '-created',
    })

    // 4. Buscar sugestões já existentes para não duplicar por documento
    const existentes = await pb.collection('pre_lancamentos').getFullList<PreLancamentoRecord>({
      filter: `tenant_id = "${tenantId}"`,
    })
    const docIdsComSugestao = new Set<string>()
    existentes.forEach((e) => {
      if (e.documento) docIdsComSugestao.add(e.documento)
    })

    let analisados = 0
    let novasSugestoes = 0
    let altaConfianca = 0
    let ignoradosOuExistentes = 0

    for (const doc of docs) {
      analisados++
      if (docIdsComSugestao.has(doc.id)) {
        ignoradosOuExistentes++
        continue
      }

      // Inferência por tipo de documento e palavras-chave
      const tipo = doc.tipo.toLowerCase()
      const nomeLower = doc.nome_arquivo.toLowerCase()
      const obsLower = (doc.observacoes || '').toLowerCase()
      const textoCompleto = `${nomeLower} ${obsLower}`

      let debitoId: string | undefined
      let creditoId: string | undefined
      let confianca = 50
      let historico = ''
      let valorSugerido = 1000.0 // valor padrão estimado caso não haja extrator OCR específico

      // Verificar mapeamento explícito por tipo de documento
      const mapTipo = mapDocs.get(tipo)
      if (mapTipo) {
        debitoId = mapTipo.conta_debito
        creditoId = mapTipo.conta_credito
        confianca += 25
      }

      // Regras heurísticas determinísticas
      if (tipo === 'nota_fiscal') {
        if (
          textoCompleto.includes('nfse') ||
          textoCompleto.includes('serviço') ||
          textoCompleto.includes('prestado') ||
          textoCompleto.includes('venda')
        ) {
          // NF de venda de serviço
          debitoId = contaClientes?.id || contaBanco?.id
          creditoId = contaRecServicos?.id
          historico = `Receita de prestação de serviços conforme ${doc.nome_arquivo}`
          confianca = 92
          valorSugerido = 15000.0
        } else {
          // NF de compra / fornecedor
          debitoId = contaDespServicos?.id
          creditoId = contaFornecedores?.id || contaBanco?.id
          historico = `Despesa operacional com aquisição/fornecedor ref. ${doc.nome_arquivo}`
          confianca = 85
          valorSugerido = 4500.0
        }
      } else if (tipo === 'fatura') {
        if (
          textoCompleto.includes('energia') ||
          textoCompleto.includes('luz') ||
          textoCompleto.includes('telefonia') ||
          textoCompleto.includes('internet')
        ) {
          debitoId = contaDespEnergia?.id
          creditoId = contaBanco?.id
          historico = `Despesa com concessionária/comunicação ref. fatura ${doc.nome_arquivo}`
          confianca = 88
          valorSugerido = 1850.0
        } else {
          debitoId = contaDespServicos?.id
          creditoId = contaFornecedores?.id || contaBanco?.id
          historico = `Liquidação de fatura de fornecedores ${doc.nome_arquivo}`
          confianca = 80
          valorSugerido = 3200.0
        }
      } else if (
        textoCompleto.includes('das') ||
        textoCompleto.includes('simples') ||
        textoCompleto.includes('darf')
      ) {
        debitoId = contaDespSimples?.id
        creditoId = contaBanco?.id
        historico = `Recolhimento tributário guia fiscal ${doc.nome_arquivo}`
        confianca = 95
        valorSugerido = 4120.0
      } else if (
        textoCompleto.includes('folha') ||
        textoCompleto.includes('salario') ||
        textoCompleto.includes('holerite')
      ) {
        debitoId = contaDespSalarios?.id
        creditoId = contaSalariosPassivo?.id || contaBanco?.id
        historico = `Apropriação da folha salarial dos colaboradores ref. ${doc.nome_arquivo}`
        confianca = 90
        valorSugerido = 18500.0
      } else if (textoCompleto.includes('iss') || textoCompleto.includes('retencao')) {
        debitoId = contaSimplesPassivo?.id || contaDespSimples?.id
        creditoId = contaBanco?.id
        historico = `Recolhimento de retenção municipal ref. comprovante ${doc.nome_arquivo}`
        confianca = 75
        valorSugerido = 1380.0
      } else if (tipo === 'relatorios') {
        debitoId = contaDespServicos?.id
        creditoId = contaBanco?.id
        historico = `Ajuste operacional de serviços apurados em relatório ${doc.nome_arquivo}`
        confianca = 62
        valorSugerido = 2500.0
      } else {
        // Outros documentos com confiança moderada
        debitoId = contaDespServicos?.id
        creditoId = contaBanco?.id
        historico = `Lançamento contábil a classificar ref. documento GED ${doc.nome_arquivo}`
        confianca = 55
        valorSugerido = 1000.0
      }

      // Criar nova sugestão de pré-lançamento
      await pb.collection('pre_lancamentos').create({
        tenant_id: tenantId,
        empresa: doc.empresa_id,
        documento: doc.id,
        competencia: compPadrao,
        debito_sugerido: debitoId,
        credito_sugerido: creditoId,
        valor_sugerido: valorSugerido,
        historico_sugerido: historico,
        confianca: Math.min(100, Math.max(0, confianca)),
        status: 'pendente',
      })

      novasSugestoes++
      if (confianca >= 80) altaConfianca++
      docIdsComSugestao.add(doc.id)
    }

    return {
      analisados,
      novasSugestoes,
      altaConfianca,
      ignoradosOuExistentes,
    }
  },
}

import pb from '@/lib/pocketbase/client'
import { auditService } from './audit'
import type {
  GuiaPagamentoRecord,
  ParcelamentoFederalRecord,
  ParcelaItem,
  ResumoGuiasPagamentosEmpresa,
  GuiaTipo,
  GuiaSituacao,
  ContaFinanceiraRecord,
  DctfwebDeclaracaoRecord,
  FiscalRecord,
  SaudeParcelamentoBadge,
  ModalidadeParcelamento,
} from '@/types'

export interface CreateGuiaInput {
  tenant_id: string
  empresa: string
  tipo_guia: GuiaTipo
  codigo_receita: string
  periodo_apuracao: string
  numero_referencia?: string
  descricao?: string
  valor_original?: number
  acrescimos?: number
  valor_total: number
  data_vencimento: string
  data_pagamento?: string | null
  situacao: GuiaSituacao
  origem?: 'manual' | 'dctfweb' | 'fiscal' | 'conector_rfb' | 'perdcomp'
  titulo_financeiro?: string
  autenticacao_bancaria?: string
  observacoes?: string
  criado_por?: string
  comprovante_arquivo?: File | null
}

export interface CreateParcelamentoInput {
  tenant_id: string
  empresa: string
  numero_parcelamento: string
  modalidade: ParcelamentoFederalRecord['modalidade']
  descricao_modalidade?: string
  data_adesao: string
  total_parcelas: number
  parcelas_quitadas: number
  valor_total_consolidado?: number
  saldo_devedor: number
  situacao_rfb: ParcelamentoFederalRecord['situacao_rfb']
  proxima_parcela_numero?: number
  proxima_parcela_vencimento?: string
  proxima_parcela_valor?: number
  quadro_parcelas_json?: ParcelaItem[]
  origem_captura?: 'manual_contador' | 'conector_rfb_dte'
  observacoes?: string
  criado_por?: string
}

export const guiasPagamentosService = {
  // ==========================================
  // 1. CONSULTAS DE GUIAS DE PAGAMENTO
  // ==========================================

  async listGuias(
    empresaId: string,
    filters?: {
      tipo?: string
      situacao?: string
      periodo?: string
    },
  ): Promise<GuiaPagamentoRecord[]> {
    try {
      const parts = [`empresa = "${empresaId}"`]
      if (filters?.tipo && filters.tipo !== 'todos') {
        parts.push(`tipo_guia = "${filters.tipo}"`)
      }
      if (filters?.situacao && filters.situacao !== 'todos') {
        parts.push(`situacao = "${filters.situacao}"`)
      }
      if (filters?.periodo && filters.periodo.trim() !== '') {
        parts.push(`periodo_apuracao ~ "${filters.periodo.trim()}"`)
      }

      const records = await pb.collection('guias_pagamentos').getFullList<GuiaPagamentoRecord>({
        filter: parts.join(' && '),
        sort: '-data_vencimento,created',
        expand: 'titulo_financeiro,criado_por',
        requestKey: null,
      })
      return records
    } catch (err) {
      console.error('[Guias] Erro ao listar guias da empresa:', err)
      return []
    }
  },

  async listTodasGuiasTenant(tenantId: string): Promise<GuiaPagamentoRecord[]> {
    try {
      return await pb.collection('guias_pagamentos').getFullList<GuiaPagamentoRecord>({
        filter: `tenant_id = "${tenantId}"`,
        sort: '-data_vencimento',
        requestKey: null,
      })
    } catch (err) {
      console.error('[Guias] Erro ao listar guias do tenant:', err)
      return []
    }
  },

  async getGuiaById(id: string): Promise<GuiaPagamentoRecord> {
    return pb.collection('guias_pagamentos').getOne<GuiaPagamentoRecord>(id, {
      expand: 'titulo_financeiro,criado_por,empresa',
    })
  },

  async createGuia(input: CreateGuiaInput, usuarioId?: string): Promise<GuiaPagamentoRecord> {
    const formData = new FormData()
    formData.append('tenant_id', input.tenant_id)
    formData.append('empresa', input.empresa)
    formData.append('tipo_guia', input.tipo_guia)
    formData.append('codigo_receita', input.codigo_receita)
    formData.append('periodo_apuracao', input.periodo_apuracao)
    if (input.numero_referencia) formData.append('numero_referencia', input.numero_referencia)
    if (input.descricao) formData.append('descricao', input.descricao)
    if (input.valor_original !== undefined)
      formData.append('valor_original', String(input.valor_original))
    if (input.acrescimos !== undefined) formData.append('acrescimos', String(input.acrescimos))
    formData.append('valor_total', String(input.valor_total))
    formData.append('data_vencimento', input.data_vencimento)
    if (input.data_pagamento) formData.append('data_pagamento', input.data_pagamento)
    formData.append('situacao', input.situacao)
    formData.append('origem', input.origem || 'manual')
    if (input.titulo_financeiro) formData.append('titulo_financeiro', input.titulo_financeiro)
    if (input.autenticacao_bancaria)
      formData.append('autenticacao_bancaria', input.autenticacao_bancaria)
    if (input.observacoes) formData.append('observacoes', input.observacoes)
    if (usuarioId) formData.append('criado_por', usuarioId)
    if (input.comprovante_arquivo) formData.append('comprovante_arquivo', input.comprovante_arquivo)

    const record = await pb.collection('guias_pagamentos').create<GuiaPagamentoRecord>(formData)

    if (usuarioId) {
      await auditService.log(
        input.tenant_id,
        usuarioId,
        'guia_pagamento_criada',
        'guias_pagamentos',
        record.id,
        `Guia ${input.tipo_guia.toUpperCase()} (${input.codigo_receita} - Comp. ${input.periodo_apuracao}) criada no valor de R$ ${input.valor_total.toFixed(2)}.`,
      )
    }

    return record
  },

  async updateGuia(
    id: string,
    data: FormData | Partial<GuiaPagamentoRecord>,
    usuarioId?: string,
    tenantId?: string,
  ): Promise<GuiaPagamentoRecord> {
    const updated = await pb.collection('guias_pagamentos').update<GuiaPagamentoRecord>(id, data)

    if (usuarioId && tenantId) {
      await auditService.log(
        tenantId,
        usuarioId,
        'guia_pagamento_atualizada',
        'guias_pagamentos',
        id,
        `Guia de pagamento atualizada (situação: ${updated.situacao}, valor: R$ ${updated.valor_total}).`,
      )
    }

    return updated
  },

  async deleteGuia(id: string, usuarioId?: string, tenantId?: string): Promise<boolean> {
    const res = await pb.collection('guias_pagamentos').delete(id)
    if (usuarioId && tenantId) {
      await auditService.log(
        tenantId,
        usuarioId,
        'guia_pagamento_excluida',
        'guias_pagamentos',
        id,
        'Guia de pagamento federal excluída.',
      )
    }
    return res
  },

  // ==========================================
  // 2. MARCAR GUIA COMO PAGA + BAIXA FINANCEIRA
  // ==========================================

  async marcarGuiaComoPaga(params: {
    guiaId: string
    tenantId: string
    empresaId: string
    usuarioId: string
    dataPagamento: string
    autenticacaoBancaria?: string
    comprovante?: File | null
    baixarNoFinanceiro: boolean
  }): Promise<GuiaPagamentoRecord> {
    const guia = await this.getGuiaById(params.guiaId)

    const formData = new FormData()
    formData.append('situacao', 'paga')
    formData.append('data_pagamento', params.dataPagamento)
    if (params.autenticacaoBancaria) {
      formData.append('autenticacao_bancaria', params.autenticacaoBancaria)
    }
    if (params.comprovante) {
      formData.append('comprovante_arquivo', params.comprovante)
    }

    // Se solicitado, realizar baixa no título financeiro correspondente ou criar a baixa
    if (params.baixarNoFinanceiro) {
      try {
        if (guia.titulo_financeiro) {
          await pb.collection('contas_financeiras').update(guia.titulo_financeiro, {
            status: 'pago',
            data_pagamento: params.dataPagamento,
            observacoes: `Baixa automática via Consulta de Guias/PAR (Autenticação: ${params.autenticacaoBancaria || 'Informada pelo contador'})`,
          })
        } else {
          // Procurar título por documento_ref
          const docRef =
            guia.numero_referencia ||
            `GUIA-${guia.tipo_guia.toUpperCase()}-${guia.periodo_apuracao.replace('/', '')}`
          const achados = await pb
            .collection('contas_financeiras')
            .getFullList<ContaFinanceiraRecord>({
              filter: `tenant_id = "${params.tenantId}" && empresa = "${params.empresaId}" && documento_ref = "${docRef}"`,
              requestKey: null,
            })

          if (achados.length > 0) {
            await pb.collection('contas_financeiras').update(achados[0].id, {
              status: 'pago',
              data_pagamento: params.dataPagamento,
              observacoes: `Baixa automática via Consulta de Guias/PAR (Autenticação: ${params.autenticacaoBancaria || 'Manual'})`,
            })
            formData.append('titulo_financeiro', achados[0].id)
          }
        }
      } catch (errFin) {
        console.warn('[Guias] Aviso ao baixar no financeiro:', errFin)
      }
    }

    const updated = await pb
      .collection('guias_pagamentos')
      .update<GuiaPagamentoRecord>(params.guiaId, formData)

    await auditService.log(
      params.tenantId,
      params.usuarioId,
      'guia_marcada_paga',
      'guias_pagamentos',
      guia.id,
      `Guia ${guia.tipo_guia.toUpperCase()} (${guia.codigo_receita} - ${guia.periodo_apuracao}) no valor de R$ ${guia.valor_total.toFixed(2)} marcada como PAGA em ${params.dataPagamento}. Baixa no financeiro: ${params.baixarNoFinanceiro ? 'Sim' : 'Não'}.`,
    )

    return updated
  },

  // ==========================================
  // 3. SINCRONIZAÇÃO AUTOMÁTICA DE FONTES (DCTFWeb + Fiscal + Financeiro)
  // Anti-duplicidade garantida por (código de receita + período + número de ref / empresa)
  // ==========================================

  async sincronizarGuiasComFontes(
    tenantId: string,
    empresaId: string,
    usuarioId?: string,
  ): Promise<{ inseridas: number; atualizadas: number }> {
    let inseridas = 0
    let atualizadas = 0

    try {
      // 3.1 Buscar declarações DCTFWeb consolidadas ou transmitidas da empresa
      const dctfList = await pb
        .collection('dctfweb_declaracoes')
        .getFullList<DctfwebDeclaracaoRecord>({
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}"`,
          requestKey: null,
        })

      // 3.2 Buscar obrigações fiscais (DARF, DAS) da empresa
      const fiscalObrigacoes = await pb.collection('fiscal').getFullList<FiscalRecord>({
        filter: `tenant_id = "${tenantId}" && empresa_id = "${empresaId}"`,
        requestKey: null,
      })

      // 3.3 Buscar títulos financeiros relacionados a tributos
      const titulosFinanceiros = await pb
        .collection('contas_financeiras')
        .getFullList<ContaFinanceiraRecord>({
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && tipo = "pagar"`,
          requestKey: null,
        })

      // 3.4 Buscar guias existentes da empresa
      const guiasExistentes = await pb
        .collection('guias_pagamentos')
        .getFullList<GuiaPagamentoRecord>({
          filter: `empresa = "${empresaId}"`,
          requestKey: null,
        })

      // Mapa para consulta rápida de guias existentes por chave
      // Chave: `tipo_guia|codigo_receita|periodo_apuracao|numero_referencia`
      const guiasMap = new Map<string, GuiaPagamentoRecord>()
      guiasExistentes.forEach((g) => {
        const chaveRef = (g.numero_referencia || '').trim().toLowerCase()
        const chaveComposta = `${g.tipo_guia}|${g.codigo_receita}|${g.periodo_apuracao}|${chaveRef}`
        guiasMap.set(chaveComposta, g)

        // Indexar também apenas por numero_referencia se existir
        if (chaveRef) {
          guiasMap.set(`ref:${chaveRef}`, g)
        }
      })

      // PROCESSAR DCTFWeb
      for (const d of dctfList) {
        if (!d.saldo_a_recolher || d.saldo_a_recolher <= 0) continue

        const numRef = (d.numero_declaracao || `DCTFWEB-${d.competencia.replace('/', '')}`).trim()
        const chaveRef = numRef.toLowerCase()
        const chaveComposta = `darf_previdenciario|111-0|${d.competencia}|${chaveRef}`

        const existente = guiasMap.get(chaveComposta) || guiasMap.get(`ref:${chaveRef}`)

        // Verificar no financeiro se já foi pago
        const tituloFin = titulosFinanceiros.find(
          (t) =>
            t.id === d.titulo_financeiro ||
            (t.documento_ref && t.documento_ref.toLowerCase() === chaveRef),
        )

        let situacaoCalculada: GuiaSituacao = 'pendente'
        let dataPagamento: string | undefined = undefined

        if (tituloFin && tituloFin.status === 'pago') {
          situacaoCalculada = 'paga'
          dataPagamento = tituloFin.data_pagamento || new Date().toISOString()
        } else if (d.prazo_legal && new Date(d.prazo_legal).getTime() < Date.now()) {
          situacaoCalculada = 'vencida'
        }

        const dataVenc = d.prazo_legal || new Date().toISOString()

        if (!existente) {
          // Inserir nova guia refletida da DCTFWeb
          await pb.collection('guias_pagamentos').create<GuiaPagamentoRecord>({
            tenant_id: tenantId,
            empresa: empresaId,
            tipo_guia: 'darf_previdenciario',
            codigo_receita: '111-0',
            periodo_apuracao: d.competencia,
            numero_referencia: numRef,
            descricao: `DARF Previdenciário DCTFWeb Comp. ${d.competencia}`,
            valor_original: d.saldo_a_recolher,
            acrescimos: 0,
            valor_total: d.saldo_a_recolher,
            data_vencimento: dataVenc,
            data_pagamento: dataPagamento,
            situacao: situacaoCalculada,
            origem: 'dctfweb',
            titulo_financeiro: tituloFin?.id || undefined,
            observacoes: `Guia originada da DCTFWeb (${d.status.toUpperCase()}) em modo de conciliação automática.`,
            criado_por: usuarioId || undefined,
          })
          inseridas++
        } else {
          // Atualizar situação se o financeiro foi baixado ou valor ajustado
          let precisaAtualizar = false
          const updates: Partial<GuiaPagamentoRecord> = {}

          if (tituloFin && tituloFin.status === 'pago' && existente.situacao !== 'paga') {
            updates.situacao = 'paga'
            updates.data_pagamento = tituloFin.data_pagamento || new Date().toISOString()
            precisaAtualizar = true
          } else if (
            existente.situacao === 'pendente' &&
            new Date(existente.data_vencimento).getTime() < Date.now()
          ) {
            updates.situacao = 'vencida'
            precisaAtualizar = true
          }

          if (tituloFin && !existente.titulo_financeiro) {
            updates.titulo_financeiro = tituloFin.id
            precisaAtualizar = true
          }

          if (precisaAtualizar) {
            await pb.collection('guias_pagamentos').update(existente.id, updates)
            atualizadas++
          }
        }
      }

      // PROCESSAR FISCAL
      for (const fisc of fiscalObrigacoes) {
        if (!fisc.periodo_apuracao) continue

        let tipoGuia: GuiaTipo = 'darf'
        let codReceita = '0000'
        if (fisc.tipo_obrigacao === 'pis_cofins') {
          tipoGuia = 'darf'
          codReceita = '5952'
        } else if (fisc.tipo_obrigacao === 'dctf') {
          tipoGuia = 'darf'
          codReceita = '2089'
        } else {
          continue
        }

        const numRef = `FISC-${fisc.tipo_obrigacao.toUpperCase()}-${fisc.periodo_apuracao.replace('/', '')}`
        const chaveRef = numRef.toLowerCase()
        const chaveComposta = `${tipoGuia}|${codReceita}|${fisc.periodo_apuracao}|${chaveRef}`

        const existente = guiasMap.get(chaveComposta) || guiasMap.get(`ref:${chaveRef}`)

        if (!existente && fisc.status === 'entregue' && fisc.data_entrega) {
          await pb.collection('guias_pagamentos').create<GuiaPagamentoRecord>({
            tenant_id: tenantId,
            empresa: empresaId,
            tipo_guia: tipoGuia,
            codigo_receita: codReceita,
            periodo_apuracao: fisc.periodo_apuracao,
            numero_referencia: numRef,
            descricao: `Guia Apuração Fiscal ${fisc.tipo_obrigacao.toUpperCase()} - Comp. ${fisc.periodo_apuracao}`,
            valor_original: 1200.0,
            acrescimos: 0,
            valor_total: 1200.0,
            data_vencimento: fisc.data_entrega,
            data_pagamento: fisc.data_entrega,
            situacao: 'paga',
            origem: 'fiscal',
            observacoes: 'Apuração e entrega fiscal concluída com sucesso.',
            criado_por: usuarioId || undefined,
          })
          inseridas++
        }
      }
    } catch (errSync) {
      console.error('[Guias] Erro ao sincronizar guias com fontes:', errSync)
    }

    return { inseridas, atualizadas }
  },

  // ==========================================
  // 4. CONSULTA E GESTÃO DE PARCELAMENTOS (PAR / PER-DCOMP)
  // ==========================================

  async listParcelamentos(empresaId: string): Promise<ParcelamentoFederalRecord[]> {
    try {
      const records = await pb
        .collection('parcelamentos_federais')
        .getFullList<ParcelamentoFederalRecord>({
          filter: `empresa = "${empresaId}"`,
          sort: 'proxima_parcela_vencimento,created',
          expand: 'criado_por',
          requestKey: null,
        })
      return records
    } catch (err) {
      console.error('[Parcelamentos] Erro ao listar parcelamentos:', err)
      return []
    }
  },

  async listTodosParcelamentosTenant(tenantId: string): Promise<ParcelamentoFederalRecord[]> {
    try {
      return await pb.collection('parcelamentos_federais').getFullList<ParcelamentoFederalRecord>({
        filter: `tenant_id = "${tenantId}"`,
        sort: 'proxima_parcela_vencimento',
        requestKey: null,
      })
    } catch (err) {
      console.error('[Parcelamentos] Erro ao listar parcelamentos do tenant:', err)
      return []
    }
  },

  async getParcelamentoById(id: string): Promise<ParcelamentoFederalRecord> {
    return pb.collection('parcelamentos_federais').getOne<ParcelamentoFederalRecord>(id, {
      expand: 'empresa,criado_por',
    })
  },

  async createParcelamento(
    input: CreateParcelamentoInput,
    usuarioId?: string,
  ): Promise<ParcelamentoFederalRecord> {
    const record = await pb.collection('parcelamentos_federais').create<ParcelamentoFederalRecord>({
      ...input,
      criado_por: usuarioId || undefined,
    })

    if (usuarioId) {
      await auditService.log(
        input.tenant_id,
        usuarioId,
        'parcelamento_federal_criado',
        'parcelamentos_federais',
        record.id,
        `Parcelamento ${input.numero_parcelamento} cadastrado (${input.modalidade.toUpperCase()} - Total: ${input.total_parcelas} parcelas, Saldo: R$ ${input.saldo_devedor.toFixed(2)}).`,
      )
    }

    return record
  },

  async updateParcelamento(
    id: string,
    data: Partial<ParcelamentoFederalRecord>,
    usuarioId?: string,
    tenantId?: string,
  ): Promise<ParcelamentoFederalRecord> {
    const updated = await pb
      .collection('parcelamentos_federais')
      .update<ParcelamentoFederalRecord>(id, data)

    if (usuarioId && tenantId) {
      await auditService.log(
        tenantId,
        usuarioId,
        'parcelamento_federal_atualizado',
        'parcelamentos_federais',
        id,
        `Parcelamento ${updated.numero_parcelamento} atualizado (Situação RFB: ${updated.situacao_rfb}, Quitadas: ${updated.parcelas_quitadas}/${updated.total_parcelas}).`,
      )
    }

    return updated
  },

  async deleteParcelamento(id: string, usuarioId?: string, tenantId?: string): Promise<boolean> {
    const res = await pb.collection('parcelamentos_federais').delete(id)
    if (usuarioId && tenantId) {
      await auditService.log(
        tenantId,
        usuarioId,
        'parcelamento_federal_excluido',
        'parcelamentos_federais',
        id,
        'Parcelamento federal removido.',
      )
    }
    return res
  },

  // Atualizar status de uma parcela específica do quadro
  async atualizarStatusParcela(
    parcelamentoId: string,
    numeroParcela: number,
    novoStatus: 'paga' | 'aberta' | 'atrasada',
    dataPagamento?: string | null,
    usuarioId?: string,
    tenantId?: string,
  ): Promise<ParcelamentoFederalRecord> {
    const parc = await this.getParcelamentoById(parcelamentoId)
    const quadro = Array.isArray(parc.quadro_parcelas_json) ? [...parc.quadro_parcelas_json] : []

    let encontrou = false
    let quitadas = 0
    let saldoRestante = 0

    quadro.forEach((p) => {
      if (p.numero === numeroParcela) {
        p.status = novoStatus
        p.dataPagamento = novoStatus === 'paga' ? dataPagamento || new Date().toISOString() : null
        encontrou = true
      }
      if (p.status === 'paga') {
        quitadas++
      } else {
        saldoRestante += p.valor_total || p.valor_principal || 0
      }
    })

    if (!encontrou) {
      throw new Error(`Parcela número ${numeroParcela} não encontrada no parcelamento.`)
    }

    // Recalcular situação RFB do parcelamento
    const temAtraso = quadro.some((p) => p.status === 'atrasada')
    const proximaAberta = quadro.find((p) => p.status === 'aberta' || p.status === 'atrasada')

    let situacaoRfb = parc.situacao_rfb
    if (quitadas === parc.total_parcelas) {
      situacaoRfb = 'liquidado'
    } else if (temAtraso) {
      situacaoRfb = 'em_atraso'
    } else {
      situacaoRfb = 'em_dia'
    }

    const payload: Partial<ParcelamentoFederalRecord> = {
      quadro_parcelas_json: quadro,
      parcelas_quitadas: quitadas,
      saldo_devedor: Number(saldoRestante.toFixed(2)),
      situacao_rfb: situacaoRfb,
      proxima_parcela_numero: proximaAberta?.numero,
      proxima_parcela_vencimento: proximaAberta?.vencimento,
      proxima_parcela_valor: proximaAberta?.valor_total,
    }

    return this.updateParcelamento(parcelamentoId, payload, usuarioId, tenantId)
  },

  // ==========================================
  // 5. CÁLCULO DE SAÚDE VISUAL & RESUMO EXECUTIVO
  // ==========================================

  calcularSaudeParcelamento(parc: ParcelamentoFederalRecord): {
    badge: SaudeParcelamentoBadge
    label: string
    diasRestantes?: number
  } {
    // 🔴 Inadimplente: em_atraso ou rescindido ou tem parcela atrasada
    if (parc.situacao_rfb === 'em_atraso' || parc.situacao_rfb === 'rescindido') {
      return {
        badge: 'inadimplente',
        label: 'Inadimplente (Parcela Atrasada)',
      }
    }

    // Verificar data de vencimento da próxima parcela
    if (parc.proxima_parcela_vencimento) {
      const venc = new Date(parc.proxima_parcela_vencimento)
      const diffMs = venc.getTime() - Date.now()
      const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      if (diffDias < 0) {
        return {
          badge: 'inadimplente',
          label: `Atrasada (${Math.abs(diffDias)}d atrás)`,
          diasRestantes: diffDias,
        }
      }

      // 🟡 Alerta: vence em ≤ 7 dias
      if (diffDias <= 7) {
        return {
          badge: 'vencendo_7d',
          label: diffDias === 0 ? 'Vence Hoje' : `Vence em ${diffDias}d`,
          diasRestantes: diffDias,
        }
      }

      return {
        badge: 'adimplente',
        label: `Adimplente (${diffDias}d para prox.)`,
        diasRestantes: diffDias,
      }
    }

    if (parc.situacao_rfb === 'liquidado') {
      return {
        badge: 'adimplente',
        label: '100% Quitado',
      }
    }

    return {
      badge: 'adimplente',
      label: 'Adimplente / Em dia',
    }
  },

  // Resumo executivo para o topo da sub-aba
  calcularResumoExecutivo(
    guias: GuiaPagamentoRecord[],
    parcelamentos: ParcelamentoFederalRecord[],
  ): ResumoGuiasPagamentosEmpresa {
    const anoAtual = new Date().getFullYear()

    let totalAberto = 0
    let totalPagoAno = 0
    let totalVencido = 0
    let qtdGuiasVencidas = 0
    let qtdGuiasAbertas = 0
    let qtdGuiasPagas = 0

    guias.forEach((g) => {
      const venc = new Date(g.data_vencimento)
      const isVencida =
        g.situacao === 'vencida' || (g.situacao === 'pendente' && venc.getTime() < Date.now())

      if (g.situacao === 'paga') {
        qtdGuiasPagas++
        const dtPag = g.data_pagamento ? new Date(g.data_pagamento) : null
        if (!dtPag || dtPag.getFullYear() === anoAtual) {
          totalPagoAno += g.valor_total || 0
        }
      } else if (isVencida) {
        qtdGuiasVencidas++
        totalVencido += g.valor_total || 0
        totalAberto += g.valor_total || 0
      } else {
        qtdGuiasAbertas++
        totalAberto += g.valor_total || 0
      }
    })

    let saldoDevedorParc = 0
    let parcAtivos = 0
    let parcComAtraso = 0
    let parcVencendo7d = 0

    parcelamentos.forEach((p) => {
      if (p.situacao_rfb !== 'liquidado') {
        parcAtivos++
        saldoDevedorParc += p.saldo_devedor || 0
        const saude = this.calcularSaudeParcelamento(p)
        if (saude.badge === 'inadimplente') parcComAtraso++
        if (saude.badge === 'vencendo_7d') parcVencendo7d++
      }
    })

    // Indicador consolidado de regularidade tributária
    let regularidade: 'regular' | 'alerta' | 'irregular' = 'regular'
    if (qtdGuiasVencidas > 0 || parcComAtraso > 0) {
      regularidade = 'irregular'
    } else if (parcVencendo7d > 0 || qtdGuiasAbertas > 0) {
      regularidade = 'alerta'
    }

    return {
      totalAberto: Number(totalAberto.toFixed(2)),
      totalPagoAno: Number(totalPagoAno.toFixed(2)),
      totalVencido: Number(totalVencido.toFixed(2)),
      qtdGuiasVencidas,
      qtdGuiasAbertas,
      qtdGuiasPagas,
      parcelamentosAtivos: parcAtivos,
      saldoDevedorParcelamentos: Number(saldoDevedorParc.toFixed(2)),
      parcelamentosComAtraso: parcComAtraso,
      parcelamentosVencendo7d: parcVencendo7d,
      regularidadeTributaria: regularidade,
    }
  },

  getTipoGuiaLabel(tipo: GuiaTipo): string {
    const labels: Record<GuiaTipo, string> = {
      darf: 'DARF Comum (IRPJ/CSLL/PIS/COFINS)',
      darf_previdenciario: 'DARF Previdenciário (INSS)',
      dae_par: 'DAE / Guia PAR (Parcelamento)',
      dctfweb: 'DARF Numerado DCTFWeb',
      das: 'DAS (Simples Nacional)',
      perdcomp: 'DCOMP / Compensação de Tributos',
    }
    return labels[tipo] || tipo.toUpperCase()
  },

  getModalidadeParcelamentoLabel(modalidade: ModalidadeParcelamento): string {
    const labels: Record<ModalidadeParcelamento, string> = {
      pert_sn: 'PERT-SN (Simples Nacional)',
      pert_demais: 'PERT Geral (Demais Débitos)',
      ordinario_rfb: 'Parcelamento Ordinário RFB (Até 60x)',
      simplificado_previdenciario: 'Simplificado Previdenciário (PGFN/RFB)',
      transacao_tributaria_pgfn: 'Transação Tributária por Adesão (PGFN)',
      perdcomp_compensacao: 'PER/DCOMP Compensação Tributária',
      outros: 'Outros Acordos e Parcelamentos',
    }
    return labels[modalidade] || modalidade
  },
}

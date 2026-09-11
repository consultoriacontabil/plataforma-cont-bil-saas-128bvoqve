import pb from '@/lib/pocketbase/client'
import { contabilService } from './contabil'
import type {
  FaturamentoRecorrenteRecord,
  StatusFaturamentoRecorrente,
  ContratoHonorarioRecord,
  ContaFinanceiraRecord,
} from '@/types'

export interface ListFaturamentoFilters {
  empresaId?: string
  status?: StatusFaturamentoRecorrente | 'todos'
  competencia?: string
  busca?: string
}

export interface GerarCompetenciaResult {
  competencia: string
  criados: number
  pulados: number
  detalhes: {
    contratoId: string
    titulo: string
    empresaNome: string
    status: 'criado' | 'ja_existente' | 'sem_empresa' | 'modelo_eventual' | 'erro'
    motivo?: string
  }[]
}

export const faturamentoRecorrenteService = {
  // Listar cobranças com filtros
  async list(
    tenantId: string,
    filters?: ListFaturamentoFilters,
  ): Promise<FaturamentoRecorrenteRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`]

    if (filters?.empresaId && filters.empresaId !== 'todas') {
      parts.push(`empresa = "${filters.empresaId}"`)
    }
    if (filters?.status && filters.status !== 'todos') {
      parts.push(`status = "${filters.status}"`)
    }
    if (filters?.competencia && filters.competencia !== 'todas') {
      parts.push(`competencia = "${filters.competencia}"`)
    }

    const records = await pb
      .collection('faturamentos_recorrentes')
      .getFullList<FaturamentoRecorrenteRecord>({
        filter: parts.join(' && '),
        sort: '-competencia,-created',
        expand: 'contrato,empresa,titulo_financeiro,criado_por',
      })

    if (filters?.busca?.trim()) {
      const q = filters.busca.trim().toLowerCase()
      return records.filter((r) => {
        const emp = r.expand?.empresa?.razao_social || r.expand?.empresa?.nome_fantasia || ''
        const contrato = r.expand?.contrato?.titulo || ''
        const comp = r.competencia || ''
        return (
          emp.toLowerCase().includes(q) ||
          contrato.toLowerCase().includes(q) ||
          comp.toLowerCase().includes(q)
        )
      })
    }

    return records
  },

  // Geração manual por competência (ex.: "2026-10")
  async gerarCompetencia(
    tenantId: string,
    competencia: string,
    userId?: string,
  ): Promise<GerarCompetenciaResult> {
    // 1. Buscar contratos do tenant ativos ('assinado' ou 'enviado')
    const contratos = await pb
      .collection('contratos_honorarios')
      .getFullList<ContratoHonorarioRecord>({
        filter: `tenant_id = "${tenantId}" && (status = "assinado" || status = "enviado")`,
        expand: 'empresa',
      })

    // 2. Buscar faturamentos já existentes na competência para anti-duplicidade
    const existentes = await pb
      .collection('faturamentos_recorrentes')
      .getFullList<FaturamentoRecorrenteRecord>({
        filter: `tenant_id = "${tenantId}" && competencia = "${competencia}"`,
      })

    const existentesContratoSet = new Set(existentes.map((e) => e.contrato))

    let criados = 0
    let pulados = 0
    const detalhes: GerarCompetenciaResult['detalhes'] = []

    const [ano, mes] = competencia.split('-')

    for (const c of contratos) {
      const empresaId = c.empresa
      const empresaNome =
        c.expand?.empresa?.nome_fantasia ||
        c.expand?.empresa?.razao_social ||
        'Prospect / Sem Empresa'

      // Regra: prospects sem empresa não geram cobrança
      if (!empresaId) {
        pulados++
        detalhes.push({
          contratoId: c.id,
          titulo: c.titulo,
          empresaNome,
          status: 'sem_empresa',
          motivo: 'Prospect sem empresa jurídica cadastrada.',
        })
        continue
      }

      // Regra: contratos com modelo "eventual" não geram recorrência
      if (c.modelo_mensalidade && c.modelo_mensalidade.toLowerCase().includes('eventual')) {
        pulados++
        detalhes.push({
          contratoId: c.id,
          titulo: c.titulo,
          empresaNome,
          status: 'modelo_eventual',
          motivo: 'Modelo de honorários definido como eventual/avulso.',
        })
        continue
      }

      // Regra: anti-duplicidade
      if (existentesContratoSet.has(c.id)) {
        pulados++
        detalhes.push({
          contratoId: c.id,
          titulo: c.titulo,
          empresaNome,
          status: 'ja_existente',
          motivo: 'Cobrança já gerada nesta competência.',
        })
        continue
      }

      try {
        const diaStr = String(c.dia_vencimento || 10).padStart(2, '0')
        const dataVenc = `${ano}-${mes}-${diaStr} 12:00:00.000Z`
        const dataEmissao = `${ano}-${mes}-01 12:00:00.000Z`
        const valor = c.valor_mensal || 0

        // Criar título no Financeiro (contas_financeiras)
        let tituloFinId: string | undefined = undefined
        try {
          const tituloCriado = await pb
            .collection('contas_financeiras')
            .create<ContaFinanceiraRecord>({
              tenant_id: tenantId,
              empresa: empresaId,
              tipo: 'receber',
              pessoa: empresaNome,
              descricao: `Honorários Contábeis Recorrentes - Comp. ${mes}/${ano}`,
              documento_ref: `FAT-${ano}${mes}-${c.id.slice(0, 6)}`,
              valor,
              data_emissao: dataEmissao,
              data_vencimento: dataVenc,
              status: 'pendente',
              observacoes: `Cobrança mensal gerada a partir do contrato: ${c.titulo}`,
            })
          tituloFinId = tituloCriado.id
        } catch (errFin) {
          console.warn('Erro ao criar título financeiro vinculado:', errFin)
        }

        // Criar registro de faturamento recorrente
        await pb.collection('faturamentos_recorrentes').create<FaturamentoRecorrenteRecord>({
          tenant_id: tenantId,
          contrato: c.id,
          empresa: empresaId,
          competencia,
          valor,
          data_vencimento: dataVenc,
          status: 'faturado',
          titulo_financeiro: tituloFinId || null,
          notas: `Faturamento gerado manualmente pelo módulo em ${new Date().toLocaleDateString('pt-BR')}`,
          criado_por: userId || null,
        })

        // Auditoria
        try {
          await pb.collection('audit_log').create({
            tenant_id: tenantId,
            usuario_id: userId || null,
            acao: 'GERAR_FATURAMENTO_RECORRENTE',
            entidade_tipo: 'faturamentos_recorrentes',
            entidade_id: c.id,
            detalhes: `Faturamento de honorários gerado para ${empresaNome} (Comp. ${mes}/${ano}) no valor de R$ ${valor.toFixed(2)}`,
          })
        } catch {
          /* intentionally ignored */
        }

        // Notificação
        try {
          await pb.collection('notificacoes').create({
            tenant_id: tenantId,
            usuario_destino_id: userId || null,
            titulo: `Cobrança Gerada: ${empresaNome}`,
            mensagem: `Honorários de ${mes}/${ano} gerados com sucesso (R$ ${valor.toFixed(2)}).`,
            tipo: 'sistema',
            link: '/contratos?tab=faturamento',
            lida: false,
          })
        } catch {
          /* intentionally ignored */
        }

        criados++
        detalhes.push({
          contratoId: c.id,
          titulo: c.titulo,
          empresaNome,
          status: 'criado',
        })
      } catch (err: any) {
        pulados++
        detalhes.push({
          contratoId: c.id,
          titulo: c.titulo,
          empresaNome,
          status: 'erro',
          motivo: err?.message || 'Falha ao salvar registro.',
        })
      }
    }

    return {
      competencia,
      criados,
      pulados,
      detalhes,
    }
  },

  // Faturar cobrança prevista (gera título financeiro se ainda não existir)
  async marcarComoFaturado(
    id: string,
    tenantId: string,
    userId?: string,
  ): Promise<FaturamentoRecorrenteRecord> {
    const fat = await pb
      .collection('faturamentos_recorrentes')
      .getOne<FaturamentoRecorrenteRecord>(id, { expand: 'contrato,empresa,titulo_financeiro' })

    let tituloId = fat.titulo_financeiro

    if (!tituloId) {
      const [ano, mes] = fat.competencia.split('-')
      const empNome =
        fat.expand?.empresa?.nome_fantasia || fat.expand?.empresa?.razao_social || 'Cliente'

      const titulo = await pb.collection('contas_financeiras').create<ContaFinanceiraRecord>({
        tenant_id: tenantId,
        empresa: fat.empresa,
        tipo: 'receber',
        pessoa: empNome,
        descricao: `Honorários Contábeis Recorrentes - Comp. ${mes}/${ano}`,
        documento_ref: `FAT-${ano}${mes}-${fat.contrato.slice(0, 6)}`,
        valor: fat.valor,
        data_emissao: new Date().toISOString(),
        data_vencimento: fat.data_vencimento,
        status: 'pendente',
        observacoes: `Faturado manualmente em ${new Date().toLocaleDateString('pt-BR')}`,
      })
      tituloId = titulo.id
    }

    const updated = await pb
      .collection('faturamentos_recorrentes')
      .update<FaturamentoRecorrenteRecord>(
        id,
        {
          status: 'faturado',
          titulo_financeiro: tituloId,
        },
        { expand: 'contrato,empresa,titulo_financeiro' },
      )

    try {
      await pb.collection('audit_log').create({
        tenant_id: tenantId,
        usuario_id: userId || null,
        acao: 'FATURAR_COBRANCA_RECORRENTE',
        entidade_tipo: 'faturamentos_recorrentes',
        entidade_id: id,
        detalhes: `Cobrança de ${fat.competencia} marcada como faturada. Título financeiro: ${tituloId}`,
      })
    } catch {
      /* intentionally ignored */
    }

    return updated
  },

  // Quitar cobrança: marca como pago e gera partida dobrada no Contábil (Receita de Serviços × Banco)
  // Respeita fechamento de competência contábil
  async marcarComoPago(
    id: string,
    dataPagamento: string,
    contaBancariaId?: string,
    userId?: string,
  ): Promise<FaturamentoRecorrenteRecord> {
    const fat = await pb
      .collection('faturamentos_recorrentes')
      .getOne<FaturamentoRecorrenteRecord>(id, {
        expand: 'contrato,empresa,titulo_financeiro',
      })

    const tenantId = fat.tenant_id
    const empresaId = fat.empresa
    const valor = fat.valor

    // Competência MM/YYYY para a escrituração
    const dt = new Date(dataPagamento)
    const compMonth = String(dt.getUTCMonth() + 1).padStart(2, '0')
    const compYear = dt.getUTCFullYear()
    const competenciaContabil = `${compMonth}/${compYear}`

    // 1. Identificar conta contábil de Bancos (1.1.1.02)
    let contaBancoContabilId = ''
    if (contaBancariaId) {
      try {
        const cb = await pb.collection('contas_bancarias').getOne(contaBancariaId)
        if (cb.conta_contabil) contaBancoContabilId = cb.conta_contabil
      } catch {
        /* intentionally ignored */
      }
    }

    if (!contaBancoContabilId) {
      const bancosPadrao = await pb.collection('plano_contas').getFullList({
        filter: `tenant_id = "${tenantId}" && codigo = "1.1.1.02"`,
        limit: 1,
      })
      if (bancosPadrao.length > 0) {
        contaBancoContabilId = bancosPadrao[0].id
      }
    }

    // 2. Identificar conta contábil de Receitas de Serviços (3.1.1 ou primeira receita)
    let contaReceitaContabilId = ''
    const receitasPadrao = await pb.collection('plano_contas').getFullList({
      filter: `tenant_id = "${tenantId}" && (codigo = "3.1.1" || tipo = "receita") && ativa = true`,
      sort: 'codigo',
      limit: 1,
    })
    if (receitasPadrao.length > 0) {
      contaReceitaContabilId = receitasPadrao[0].id
    }

    // 3. Se tiver as duas contas, gerar partida dobrada:
    // Débito em Banco (Ativo) e Crédito em Receita de Serviços (Resultado)
    // Se a competência estiver fechada no módulo de Fecho, o hook ou serviço lançará erro
    let loteContabilId: string | undefined = undefined
    if (contaBancoContabilId && contaReceitaContabilId) {
      loteContabilId = `FAT-REC-${fat.id.slice(0, 6)}-${Date.now()}`
      const empNome =
        fat.expand?.empresa?.nome_fantasia || fat.expand?.empresa?.razao_social || 'Cliente'

      await contabilService.createPartidaDobrada({
        tenant_id: tenantId,
        empresa: empresaId,
        data: dataPagamento,
        competencia: competenciaContabil,
        valor,
        historico: `Recebimento de honorários contábeis comp. ${fat.competencia} (${empNome})`,
        debitoContaId: contaBancoContabilId,
        creditoContaId: contaReceitaContabilId,
        status: 'confirmado',
        criado_por: userId,
      })
    }

    // 4. Se tiver título financeiro vinculado, atualizar no Financeiro para 'pago'
    if (fat.titulo_financeiro) {
      try {
        const payloadTit: Record<string, unknown> = {
          status: 'pago',
          data_pagamento: dataPagamento,
        }
        if (contaBancariaId) payloadTit.conta_bancaria = contaBancariaId
        if (loteContabilId) payloadTit.lote_contabil_id = loteContabilId
        await pb.collection('contas_financeiras').update(fat.titulo_financeiro, payloadTit)
      } catch (errTit) {
        console.warn('Erro ao atualizar título financeiro como pago:', errTit)
      }
    }

    // 5. Atualizar o faturamento recorrente
    const updated = await pb
      .collection('faturamentos_recorrentes')
      .update<FaturamentoRecorrenteRecord>(
        id,
        {
          status: 'pago',
          notas: (fat.notas ? fat.notas + ' | ' : '') + `Quitado em ${dataPagamento.split('T')[0]}`,
        },
        { expand: 'contrato,empresa,titulo_financeiro' },
      )

    // Auditoria
    try {
      await pb.collection('audit_log').create({
        tenant_id: tenantId,
        usuario_id: userId || null,
        acao: 'QUITAR_FATURAMENTO_RECORRENTE',
        entidade_tipo: 'faturamentos_recorrentes',
        entidade_id: id,
        detalhes: `Cobrança de honorários comp. ${fat.competencia} quitada no valor de R$ ${valor.toFixed(2)}. Partida contábil: Receita x Banco.`,
      })
    } catch {
      /* intentionally ignored */
    }

    return updated
  },

  // Cancelar cobrança com motivo
  async cancelar(
    id: string,
    motivo: string,
    tenantId: string,
    userId?: string,
  ): Promise<FaturamentoRecorrenteRecord> {
    if (!motivo.trim()) {
      throw new Error('O motivo do cancelamento é obrigatório.')
    }

    const fat = await pb
      .collection('faturamentos_recorrentes')
      .getOne<FaturamentoRecorrenteRecord>(id)

    // Se houver título financeiro vinculado, cancelar no Financeiro também
    if (fat.titulo_financeiro) {
      try {
        await pb.collection('contas_financeiras').update(fat.titulo_financeiro, {
          status: 'cancelado',
          observacoes: `Título cancelado devido ao cancelamento do faturamento recorrente: ${motivo.trim()}`,
        })
      } catch (errTit) {
        console.warn('Erro ao cancelar título vinculado:', errTit)
      }
    }

    const updated = await pb
      .collection('faturamentos_recorrentes')
      .update<FaturamentoRecorrenteRecord>(
        id,
        {
          status: 'cancelado',
          motivo_cancelamento: motivo.trim(),
        },
        { expand: 'contrato,empresa,titulo_financeiro' },
      )

    try {
      await pb.collection('audit_log').create({
        tenant_id: tenantId,
        usuario_id: userId || null,
        acao: 'CANCELAR_FATURAMENTO_RECORRENTE',
        entidade_tipo: 'faturamentos_recorrentes',
        entidade_id: id,
        detalhes: `Faturamento comp. ${fat.competencia} cancelado. Motivo: ${motivo.trim()}`,
      })
    } catch {
      /* intentionally ignored */
    }

    return updated
  },
}

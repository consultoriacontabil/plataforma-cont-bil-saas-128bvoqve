import pb from '@/lib/pocketbase/client'
import type {
  FechamentoCompetenciaRecord,
  FechamentoChecklistItemRecord,
  FechamentoStatus,
  ObrigacaoRecord,
  LancamentoContabil,
  Documento,
  AtivoPatrimonial,
} from '@/types'

export const ITENS_CHECKLIST_PADRAO = [
  {
    codigo_item: 'conciliacao_bancaria',
    titulo: 'Conciliação Bancária Concluída',
    descricao: 'Conferir extratos OFX de todas as contas correntes com lançamentos bancários',
    ordem: 1,
    obrigatorio: true,
  },
  {
    codigo_item: 'folha_paga',
    titulo: 'Folha de Pagamento e Impostos Retidos (DARF/FGTS)',
    descricao:
      'Verificar holerites, quitação de salários e recolhimento das retenções de INSS, IRRF e FGTS',
    ordem: 2,
    obrigatorio: true,
  },
  {
    codigo_item: 'obrigacoes_entregues',
    titulo: 'Obrigações Fiscais e Acessórias Entregues',
    descricao: 'Confirmar entrega de DAS, SPED, DCTF e demais guias com recibos arquivados',
    ordem: 3,
    obrigatorio: true,
  },
  {
    codigo_item: 'lancamentos_confirmados',
    titulo: 'Lançamentos Contábeis Confirmados',
    descricao: 'Garantir que nenhum lançamento do mês esteja em status de rascunho',
    ordem: 4,
    obrigatorio: true,
  },
  {
    codigo_item: 'depreciacao_processada',
    titulo: 'Depreciação do Imobilizado Processada',
    descricao:
      'Calcular e contabilizar as quotas de depreciação linear de todos os ativos da empresa',
    ordem: 5,
    obrigatorio: true,
  },
  {
    codigo_item: 'balancete_conferido',
    titulo: 'Balancete de Verificação Conferido',
    descricao: 'Assegurar que Total Débitos = Total Créditos sem diferença de partida dobrada',
    ordem: 6,
    obrigatorio: true,
  },
  {
    codigo_item: 'documentos_arquivados',
    titulo: 'Documentos do Mês Arquivados no GED',
    descricao: 'Notas fiscais de entrada/saída, faturas e comprovantes devidamente organizados',
    ordem: 7,
    obrigatorio: false,
  },
]

export const fechoMensalService = {
  // === Fechamento por Empresa + Competência ===
  async getFechamento(tenantId: string, empresaId: string, competencia: string) {
    const filter = `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`
    const list = await pb
      .collection('fechamento_competencia')
      .getFullList<FechamentoCompetenciaRecord>({
        filter,
        expand: 'empresa,fechado_por,reaberto_por',
      })
    return list.length > 0 ? list[0] : null
  },

  async listFechamentos(tenantId: string, competencia?: string) {
    let filter = `tenant_id = "${tenantId}"`
    if (competencia && competencia !== 'todas') {
      filter += ` && competencia = "${competencia}"`
    }
    return pb.collection('fechamento_competencia').getFullList<FechamentoCompetenciaRecord>({
      filter,
      sort: 'empresa,-created',
      expand: 'empresa,fechado_por,reaberto_por',
    })
  },

  // Inicializa ou carrega o checklist para a competência da empresa
  async inicializarOuObterChecklist(
    tenantId: string,
    empresaId: string,
    competencia: string,
  ): Promise<{
    fechamento: FechamentoCompetenciaRecord
    itens: FechamentoChecklistItemRecord[]
  }> {
    let fechamento = await this.getFechamento(tenantId, empresaId, competencia)

    if (!fechamento) {
      fechamento = await pb
        .collection('fechamento_competencia')
        .create<FechamentoCompetenciaRecord>({
          tenant_id: tenantId,
          empresa: empresaId,
          competencia,
          status: 'aberto',
          observacoes: 'Processo de fechamento iniciado',
        })
    }

    // Carregar itens do checklist
    let itens = await pb
      .collection('fechamento_checklist_itens')
      .getFullList<FechamentoChecklistItemRecord>({
        filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`,
        sort: 'ordem',
        expand: 'responsavel',
      })

    // Se ainda não existirem os itens, criar a partir do padrão
    if (itens.length === 0) {
      for (const padrao of ITENS_CHECKLIST_PADRAO) {
        await pb.collection('fechamento_checklist_itens').create({
          tenant_id: tenantId,
          fechamento: fechamento.id,
          empresa: empresaId,
          competencia,
          codigo_item: padrao.codigo_item,
          titulo: padrao.titulo,
          descricao: padrao.descricao,
          ordem: padrao.ordem,
          obrigatorio: padrao.obrigatorio,
          concluido: false,
          status_automatico: 'pendente',
        })
      }

      itens = await pb
        .collection('fechamento_checklist_itens')
        .getFullList<FechamentoChecklistItemRecord>({
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`,
          sort: 'ordem',
          expand: 'responsavel',
        })
    }

    return { fechamento, itens }
  },

  // Marcar item como concluído ou pendente manualmente
  async toggleChecklistItem(
    itemId: string,
    concluido: boolean,
    responsavelId?: string,
  ): Promise<FechamentoChecklistItemRecord> {
    return pb.collection('fechamento_checklist_itens').update<FechamentoChecklistItemRecord>(
      itemId,
      {
        concluido,
        concluido_em: concluido ? new Date().toISOString() : null,
        responsavel: concluido ? responsavelId || null : null,
      },
      { expand: 'responsavel' },
    )
  },

  // Checagem automática do estado real dos itens do checklist
  async verificarStatusAutomatico(
    tenantId: string,
    empresaId: string,
    competencia: string,
  ): Promise<
    Record<
      string,
      {
        status: 'ok' | 'alerta' | 'pendente'
        detalhe: string
      }
    >
  > {
    const res: Record<string, { status: 'ok' | 'alerta' | 'pendente'; detalhe: string }> = {}

    try {
      // 1. Obrigações fiscais
      const obrigacoes = await pb.collection('obrigacoes').getFullList<ObrigacaoRecord>({
        filter: `tenant_id = "${tenantId}" && empresa_id = "${empresaId}" && competencia = "${competencia}"`,
      })
      const obrPendentes = obrigacoes.filter(
        (o) => o.status !== 'entregue' && o.status !== 'cancelada',
      )
      if (obrigacoes.length === 0) {
        res.obrigacoes_entregues = {
          status: 'ok',
          detalhe: 'Nenhuma obrigação registrada para o período',
        }
      } else if (obrPendentes.length === 0) {
        res.obrigacoes_entregues = {
          status: 'ok',
          detalhe: `Todas as ${obrigacoes.length} obrigações estão entregues`,
        }
      } else {
        res.obrigacoes_entregues = {
          status: 'alerta',
          detalhe: `${obrPendentes.length} de ${obrigacoes.length} obrigações ainda não entregues`,
        }
      }

      // 2. Lançamentos contábeis (checar se há rascunhos)
      const lancamentos = await pb
        .collection('lancamentos_contabeis')
        .getFullList<LancamentoContabil>({
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`,
        })
      const rascunhos = lancamentos.filter((l) => l.status === 'rascunho')
      if (lancamentos.length === 0) {
        res.lancamentos_confirmados = {
          status: 'pendente',
          detalhe: 'Nenhum lançamento registrado no mês',
        }
      } else if (rascunhos.length === 0) {
        res.lancamentos_confirmados = {
          status: 'ok',
          detalhe: `Todos os ${lancamentos.length} lançamentos estão confirmados`,
        }
      } else {
        res.lancamentos_confirmados = {
          status: 'alerta',
          detalhe: `${rascunhos.length} lançamentos em rascunho pendentes de confirmação`,
        }
      }

      // 3. Depreciação do imobilizado
      const ativos = await pb.collection('ativos').getFullList<AtivoPatrimonial>({
        filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && status = "ativo"`,
      })
      if (ativos.length === 0) {
        res.depreciacao_processada = {
          status: 'ok',
          detalhe: 'Nenhum ativo ativo para depreciar',
        }
      } else {
        const ativosPendentes = ativos.filter(
          (a) => a.ultima_competencia_depreciada !== competencia,
        )
        if (ativosPendentes.length === 0) {
          res.depreciacao_processada = {
            status: 'ok',
            detalhe: `Depreciação processada para todos os ${ativos.length} ativos`,
          }
        } else {
          res.depreciacao_processada = {
            status: 'alerta',
            detalhe: `${ativosPendentes.length} de ${ativos.length} bens ainda não depreciados na comp. ${competencia}`,
          }
        }
      }

      // 4. Balancete conferido (Débitos = Créditos)
      const debTotal = lancamentos
        .filter((l) => l.tipo === 'debito' && l.status === 'confirmado')
        .reduce((acc, cur) => acc + cur.valor, 0)
      const credTotal = lancamentos
        .filter((l) => l.tipo === 'credito' && l.status === 'confirmado')
        .reduce((acc, cur) => acc + cur.valor, 0)
      const dif = Math.abs(debTotal - credTotal)

      if (lancamentos.length > 0 && dif < 0.01) {
        res.balancete_conferido = {
          status: 'ok',
          detalhe: `Partidas equilibradas (R$ ${debTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
        }
      } else if (lancamentos.length === 0) {
        res.balancete_conferido = {
          status: 'pendente',
          detalhe: 'Sem movimentação confirmada',
        }
      } else {
        res.balancete_conferido = {
          status: 'alerta',
          detalhe: `Diferença de partida detectada: R$ ${dif.toFixed(2)}`,
        }
      }

      // 2.1 Verificação de Folha e Impostos Retidos (DARF/FGTS)
      try {
        const folhas = await pb.collection('folha_pagamento').getFullList({
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`,
        })
        const impostos = await pb.collection('impostos_retidos').getFullList({
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`,
        })

        if (folhas.length === 0) {
          res.folha_paga = {
            status: 'pendente',
            detalhe: 'Nenhuma folha de pagamento calculada para o período',
          }
        } else {
          const folhasNaoPagas = folhas.filter((f) => f.status !== 'paga')
          const impostosPendentes = impostos.filter((i) => i.status !== 'pago')

          if (folhasNaoPagas.length === 0 && impostosPendentes.length === 0) {
            res.folha_paga = {
              status: 'ok',
              detalhe: `Folha quitada (${folhas.length} colaboradores) e ${impostos.length} guias de retenção pagas`,
            }
          } else {
            const pendenciasDesc: string[] = []
            if (folhasNaoPagas.length > 0)
              pendenciasDesc.push(`${folhasNaoPagas.length} folhas pendentes de quitação`)
            if (impostosPendentes.length > 0)
              pendenciasDesc.push(`${impostosPendentes.length} impostos retidos pendentes`)
            res.folha_paga = {
              status: 'alerta',
              detalhe: pendenciasDesc.join('; '),
            }
          }
        }
      } catch (errFolha) {
        console.warn('Erro ao checar folha/impostos no checklist:', errFolha)
      }

      // 5. Documentos do mês arquivados
      const docs = await pb.collection('documentos').getFullList<Documento>({
        filter: `tenant_id = "${tenantId}" && empresa_id = "${empresaId}"`,
      })
      const pendentesDocs = docs.filter((d) => d.status === 'pendente')
      res.documentos_arquivados = {
        status: pendentesDocs.length === 0 ? 'ok' : 'pendente',
        detalhe:
          pendentesDocs.length === 0
            ? `${docs.length} documentos validados no GED`
            : `${pendentesDocs.length} documentos aguardando processamento`,
      }
    } catch (err) {
      console.error('Erro ao verificar status automático de fechamento:', err)
    }

    return res
  },

  // Aprovar Fechamento da Competência (Apenas Contador ou Administrador)
  async aprovarFechamento(
    fechamentoId: string,
    usuarioId: string,
    observacoes?: string,
  ): Promise<FechamentoCompetenciaRecord> {
    return pb.collection('fechamento_competencia').update<FechamentoCompetenciaRecord>(
      fechamentoId,
      {
        status: 'fechado',
        data_fechamento: new Date().toISOString(),
        fechado_por: usuarioId,
        observacoes: observacoes || undefined,
        reaberto_em: null,
        reaberto_por: null,
      },
      { expand: 'empresa,fechado_por,reaberto_por' },
    )
  },

  // Reabrir Competência Fechada (Apenas Administrador com motivo)
  async reabrirCompetencia(
    fechamentoId: string,
    usuarioId: string,
    motivo: string,
  ): Promise<FechamentoCompetenciaRecord> {
    return pb.collection('fechamento_competencia').update<FechamentoCompetenciaRecord>(
      fechamentoId,
      {
        status: 'em_andamento',
        reaberto_em: new Date().toISOString(),
        reaberto_por: usuarioId,
        motivo_reabertura: motivo,
      },
      { expand: 'empresa,fechado_por,reaberto_por' },
    )
  },
}

import pb from '@/lib/pocketbase/client'
import type {
  Funcionario,
  Empresa,
  FolhaPagamento,
  EsocialEventoRecord,
  VerbaLancamentoRecord,
  FeriasPeriodoRecord,
  DecimoTerceiroRecord,
  BeneficioConcedidoRecord,
  RescisaoRecord,
  HistoricoSalarialRecord,
  ConvencaoColetivaRecord,
  EventoDp,
} from '@/types'
import { esocialService, type ConformidadeFuncionario } from '@/services/esocial'

export type TimelineItemCategoria =
  | 'admissao'
  | 'alteracao_cadastral'
  | 'alteracao_salarial'
  | 'afastamento'
  | 'ferias'
  | 'decimo_terceiro'
  | 'folha'
  | 'beneficio'
  | 'esocial'
  | 'rescisao'
  | 'aviso_previo'

export interface TimelineItem {
  id: string
  data: string // ISO ou YYYY-MM-DD
  titulo: string
  descricaoCurta: string
  categoria: TimelineItemCategoria
  status?: string // 'concluido' | 'previsto' | 'transmitido' | 'rejeitado' | 'pendente' | 'pago'
  isPrevisto?: boolean
  badgeTexto?: string
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'
  detalhes?: Record<string, any>
  referenciaOrigem?: {
    tipo:
      | 'evento_esocial'
      | 'folha'
      | 'ferias'
      | 'decimo'
      | 'beneficio'
      | 'rescisao'
      | 'historico_salarial'
      | 'evento_dp'
    id: string
    xml?: string
    protocolo?: string
  }
}

export interface FichaColaboradorCompleta {
  funcionario: Funcionario
  empresa?: Empresa
  conformidadeEsocial: ConformidadeFuncionario
  convencaoVigente?: ConvencaoColetivaRecord | null
  eventosEsocial: EsocialEventoRecord[]
  folhas: FolhaPagamento[]
  verbasLancamentos: VerbaLancamentoRecord[]
  ferias: FeriasPeriodoRecord[]
  decimos: DecimoTerceiroRecord[]
  beneficios: BeneficioConcedidoRecord[]
  historicosSalariais: HistoricoSalarialRecord[]
  eventosDp: EventoDp[]
  rescisao?: RescisaoRecord | null
  timeline: TimelineItem[]
  resumoFinanceiro: {
    salarioAtual: number
    ultimoBrutoApurado: number
    totalBeneficiosMensal: number
    ultimoLiquido: number
  }
}

export const fichaColaboradorService = {
  /**
   * Carrega a visão 360º completa do colaborador a partir de todas as coleções existentes
   */
  async getFicha360(tenantId: string, funcionarioId: string): Promise<FichaColaboradorCompleta> {
    // 1. Buscar colaborador com expand de empresa
    const funcRecord = await pb.collection('funcionarios').getOne(funcionarioId, {
      expand: 'empresa',
    })
    const funcionario = funcRecord as unknown as Funcionario

    const empresaId = funcionario.empresa

    // 2. Buscar todas as coleções vinculadas em paralelo com isolamento multi-tenant
    const [
      empresaRes,
      eventosEsocialRes,
      folhasRes,
      verbasRes,
      feriasRes,
      decimosRes,
      beneficiosRes,
      historicosRes,
      eventosDpRes,
      rescisoesRes,
      convencoesRes,
    ] = await Promise.all([
      empresaId
        ? pb
            .collection('empresas')
            .getOne(empresaId)
            .catch(() => null)
        : Promise.resolve(null),
      pb
        .collection('esocial_eventos')
        .getFullList({
          filter: `tenant_id = "${tenantId}" && funcionario = "${funcionarioId}"`,
          sort: '-created',
        })
        .catch(() => []),
      pb
        .collection('folha_pagamento')
        .getFullList({
          filter: `tenant_id = "${tenantId}" && funcionario = "${funcionarioId}"`,
          sort: '-competencia',
        })
        .catch(() => []),
      pb
        .collection('verbas_lancamentos')
        .getFullList({
          filter: `tenant_id = "${tenantId}" && funcionario = "${funcionarioId}"`,
          expand: 'verba',
          sort: '-competencia',
        })
        .catch(() => []),
      pb
        .collection('ferias_periodos')
        .getFullList({
          filter: `tenant_id = "${tenantId}" && funcionario = "${funcionarioId}"`,
          sort: '-periodo_aquisitivo_inicio',
        })
        .catch(() => []),
      pb
        .collection('decimo_terceiro')
        .getFullList({
          filter: `tenant_id = "${tenantId}" && funcionario = "${funcionarioId}"`,
          sort: '-ano,-parcela',
        })
        .catch(() => []),
      pb
        .collection('beneficios_concedidos')
        .getFullList({
          filter: `tenant_id = "${tenantId}" && funcionario = "${funcionarioId}"`,
          sort: '-competencia',
        })
        .catch(() => []),
      pb
        .collection('historico_salarial')
        .getFullList({
          filter: `tenant_id = "${tenantId}" && funcionario = "${funcionarioId}"`,
          expand: 'convencao_origem',
          sort: '-data_alteracao',
        })
        .catch(() => []),
      pb
        .collection('eventos_dp')
        .getFullList({
          filter: `tenant_id = "${tenantId}" && funcionario = "${funcionarioId}"`,
          sort: '-data_evento',
        })
        .catch(() => []),
      pb
        .collection('rescisoes')
        .getFullList({
          filter: `tenant_id = "${tenantId}" && funcionario = "${funcionarioId}"`,
          sort: '-created',
          limit: 1,
        })
        .catch(() => []),
      empresaId
        ? pb
            .collection('convencoes_coletivas')
            .getFullList({
              filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}"`,
              sort: '-vigencia_inicio',
            })
            .catch(() => [])
        : Promise.resolve([]),
    ])

    const empresa = (empresaRes as unknown as Empresa) || funcionario.expand?.empresa
    const eventosEsocial = eventosEsocialRes as unknown as EsocialEventoRecord[]
    const folhas = folhasRes as unknown as FolhaPagamento[]
    const verbasLancamentos = verbasRes as unknown as VerbaLancamentoRecord[]
    const ferias = feriasRes as unknown as FeriasPeriodoRecord[]
    const decimos = decimosRes as unknown as DecimoTerceiroRecord[]
    const beneficios = beneficiosRes as unknown as BeneficioConcedidoRecord[]
    const historicosSalariais = historicosRes as unknown as HistoricoSalarialRecord[]
    const eventosDp = eventosDpRes as unknown as EventoDp[]
    const rescisao = (rescisoesRes[0] as unknown as RescisaoRecord) || null
    const convencoes = convencoesRes as unknown as ConvencaoColetivaRecord[]
    const convencaoVigente =
      convencoes.find((c) => c.status_vigencia === 'vigente') || convencoes[0] || null

    // 3. Conformidade e-Social
    const conformidadeEsocial = esocialService.validarConformidadeFuncionario(funcionario)

    // 4. Montar Timeline vertical unificada (ordem cronológica mais recente no topo)
    const timeline = this.construirTimeline({
      funcionario,
      empresa,
      eventosEsocial,
      folhas,
      verbasLancamentos,
      ferias,
      decimos,
      beneficios,
      historicosSalariais,
      eventosDp,
      rescisao,
    })

    // 5. Resumo financeiro consolidado
    const ultFolha = folhas[0]
    let ultimoBruto = funcionario.salario || 0
    let ultimoLiq = ultFolha?.total_liquido || 0
    if (ultFolha) {
      if (ultFolha.proventos) {
        try {
          const arr =
            typeof ultFolha.proventos === 'string'
              ? JSON.parse(ultFolha.proventos)
              : ultFolha.proventos
          if (Array.isArray(arr) && arr.length > 0) {
            ultimoBruto = arr.reduce((acc, c) => acc + (c.valor || 0), 0)
          }
        } catch {
          /* intentionally ignored */
        }
      }
    }

    const totalBeneficios = beneficios
      .filter((b) => b.status !== 'cancelado')
      .slice(0, 3)
      .reduce((acc, cur) => acc + (cur.valor_total_beneficio || 0), 0)

    return {
      funcionario,
      empresa,
      conformidadeEsocial,
      convencaoVigente,
      eventosEsocial,
      folhas,
      verbasLancamentos,
      ferias,
      decimos,
      beneficios,
      historicosSalariais,
      eventosDp,
      rescisao,
      timeline,
      resumoFinanceiro: {
        salarioAtual: funcionario.salario || 0,
        ultimoBrutoApurado: ultimoBruto,
        totalBeneficiosMensal: totalBeneficios,
        ultimoLiquido: ultimoLiq,
      },
    }
  },

  /**
   * Consolida todos os fatos do vínculo numa lista cronológica ordenada (mais recente no topo)
   */
  construirTimeline(dados: {
    funcionario: Funcionario
    empresa?: Empresa
    eventosEsocial: EsocialEventoRecord[]
    folhas: FolhaPagamento[]
    verbasLancamentos: VerbaLancamentoRecord[]
    ferias: FeriasPeriodoRecord[]
    decimos: DecimoTerceiroRecord[]
    beneficios: BeneficioConcedidoRecord[]
    historicosSalariais: HistoricoSalarialRecord[]
    eventosDp: EventoDp[]
    rescisao?: RescisaoRecord | null
  }): TimelineItem[] {
    const itens: TimelineItem[] = []
    const agora = new Date()

    // 1. Admissão
    if (dados.funcionario.data_admissao) {
      itens.push({
        id: `admissao-${dados.funcionario.id}`,
        data: dados.funcionario.data_admissao,
        titulo: 'Admissão Contratual (Início do Vínculo)',
        descricaoCurta: `Admitido no cargo de ${dados.funcionario.cargo} (${dados.funcionario.tipo.toUpperCase()}) com salário inicial de R$ ${Number(dados.funcionario.salario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        categoria: 'admissao',
        status: 'concluido',
        badgeTexto: 'Admissão',
        badgeVariant: 'success',
        detalhes: {
          cargo: dados.funcionario.cargo,
          salario: dados.funcionario.salario,
          regime: dados.funcionario.tipo,
          cbo: dados.funcionario.cbo,
          matricula: dados.funcionario.matricula_esocial,
        },
      })
    }

    // 2. Histórico Salarial / Reajustes / Convenções
    dados.historicosSalariais.forEach((h) => {
      itens.push({
        id: `hist-sal-${h.id}`,
        data: h.data_alteracao || h.created,
        titulo: `Alteração Salarial (${h.motivo === 'reajuste_convencao_coletiva' ? 'CCT / Convenção' : h.motivo.replace(/_/g, ' ')})`,
        descricaoCurta: `Reajuste de ${h.percentual_aplicado || 0}%: Salário de R$ ${Number(h.salario_anterior || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para R$ ${Number(h.salario_novo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (+R$ ${Number(h.diferenca_mensal || 0).toFixed(2)}/mês).`,
        categoria: 'alteracao_salarial',
        status: h.revertido ? 'revertido' : 'concluido',
        badgeTexto: `+${h.percentual_aplicado}%`,
        badgeVariant: 'default',
        detalhes: {
          motivo: h.motivo,
          salario_anterior: h.salario_anterior,
          salario_novo: h.salario_novo,
          diferenca_mensal: h.diferenca_mensal,
          convencao: h.expand?.convencao_origem?.titulo,
        },
        referenciaOrigem: {
          tipo: 'historico_salarial',
          id: h.id,
        },
      })
    })

    // 3. Férias Concedidas / Calculadas / Agendadas
    dados.ferias.forEach((f) => {
      const dtGozo = f.data_inicio_gozo ? new Date(f.data_inicio_gozo) : null
      const isFuturo = dtGozo ? dtGozo.getTime() > agora.getTime() : false
      itens.push({
        id: `ferias-${f.id}`,
        data: f.data_inicio_gozo || f.created,
        titulo: isFuturo ? 'Férias Programadas (Previsto)' : 'Férias Concedidas & Quitado',
        descricaoCurta: `${f.dias_gozo} dias de gozo (${f.vender_abono ? `+${f.dias_abono} dias abono pecuniário` : 'sem abono'}) • Período: ${f.data_inicio_gozo?.slice(0, 10)} a ${f.data_fim_gozo?.slice(0, 10)}. Total Líquido: R$ ${Number(f.total_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        categoria: 'ferias',
        status: isFuturo ? 'previsto' : f.status,
        isPrevisto: isFuturo,
        badgeTexto: isFuturo ? 'Previsto / Agendado' : f.status === 'pago' ? 'Pago' : 'Calculado',
        badgeVariant: isFuturo ? 'outline' : f.status === 'pago' ? 'success' : 'warning',
        detalhes: {
          periodoAquisitivo: `${f.periodo_aquisitivo_inicio?.slice(0, 10)} a ${f.periodo_aquisitivo_fim?.slice(0, 10)}`,
          periodoGozo: `${f.data_inicio_gozo?.slice(0, 10)} a ${f.data_fim_gozo?.slice(0, 10)}`,
          diasGozo: f.dias_gozo,
          diasAbono: f.dias_abono,
          totalBruto: f.total_bruto,
          totalLiquido: f.total_liquido,
          dataLimitePagamento: f.data_limite_pagamento,
        },
        referenciaOrigem: {
          tipo: 'ferias',
          id: f.id,
        },
      })
    })

    // 4. 13º Salário
    dados.decimos.forEach((d) => {
      const parcelaNome =
        d.parcela === 'primeira_parcela'
          ? '1ª Parcela'
          : d.parcela === 'segunda_parcela'
            ? '2ª Parcela'
            : 'Parcela Única'
      itens.push({
        id: `decimo-${d.id}`,
        data: d.pago_em || d.created,
        titulo: `13º Salário — ${parcelaNome} (${d.ano})`,
        descricaoCurta: `Valor R$ ${Number(d.total_liquido || d.valor_bruto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${d.meses_trabalhados}/12 avos) • Guia INSS cód. ${d.codigo_receita_inss || '2172'}.`,
        categoria: 'decimo_terceiro',
        status: d.status,
        badgeTexto: d.status === 'pago' ? 'Quitado' : 'Calculado',
        badgeVariant: d.status === 'pago' ? 'success' : 'default',
        detalhes: {
          ano: d.ano,
          parcela: d.parcela,
          mesesTrabalhados: d.meses_trabalhados,
          valorBruto: d.valor_bruto,
          totalDescontos: d.total_descontos,
          totalLiquido: d.total_liquido,
          inss: d.inss,
          irrf: d.irrf,
        },
        referenciaOrigem: {
          tipo: 'decimo',
          id: d.id,
        },
      })
    })

    // 5. Folhas Fechadas / Processadas
    dados.folhas.forEach((folha) => {
      itens.push({
        id: `folha-${folha.id}`,
        data: folha.pago_em || folha.created,
        titulo: `Folha de Pagamento Fechada (${folha.competencia})`,
        descricaoCurta: `Salário Base R$ ${Number(folha.salario_base || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • INSS: R$ ${Number(folha.inss || 0).toFixed(2)} • IRRF: R$ ${Number(folha.irrf || 0).toFixed(2)} • Líquido: R$ ${Number(folha.total_liquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        categoria: 'folha',
        status: folha.status,
        badgeTexto: folha.status === 'paga' ? 'Paga' : 'Processada',
        badgeVariant: folha.status === 'paga' ? 'success' : 'secondary',
        detalhes: {
          competencia: folha.competencia,
          salarioBase: folha.salario_base,
          inss: folha.inss,
          irrf: folha.irrf,
          fgts: folha.fgts,
          liquido: folha.total_liquido,
          proventos: folha.proventos,
          descontos: folha.descontos,
        },
        referenciaOrigem: {
          tipo: 'folha',
          id: folha.id,
        },
      })
    })

    // 6. Benefícios VT / VA / VR Concedidos
    dados.beneficios.forEach((b) => {
      const tipoNome =
        b.tipo === 'vale_transporte'
          ? 'Vale Transporte (VT)'
          : b.tipo === 'vale_refeicao'
            ? 'Vale Refeição (VR)'
            : 'Vale Alimentação (VA)'
      itens.push({
        id: `beneficio-${b.id}`,
        data: b.data_entrega || b.created,
        titulo: `Concessão de Benefício — ${tipoNome}`,
        descricaoCurta: `${b.operadora || 'Operadora'} (${b.competencia}): R$ ${Number(b.valor_total_beneficio || 0).toFixed(2)} (${b.dias_uteis} dias úteis). Custo Empresa: R$ ${Number(b.custo_empresa || 0).toFixed(2)} • Desconto: R$ ${Number(b.desconto_colaborador || 0).toFixed(2)}.`,
        categoria: 'beneficio',
        status: b.status,
        badgeTexto: b.status === 'entregue' ? 'Entregue' : 'Pendente',
        badgeVariant: b.status === 'entregue' ? 'success' : 'outline',
        detalhes: {
          tipo: b.tipo,
          competencia: b.competencia,
          operadora: b.operadora,
          diasUteis: b.dias_uteis,
          valorTotal: b.valor_total_beneficio,
          custoEmpresa: b.custo_empresa,
          descontoColaborador: b.desconto_colaborador,
          cartao: b.numero_cartao,
        },
        referenciaOrigem: {
          tipo: 'beneficio',
          id: b.id,
        },
      })
    })

    // 7. Eventos e-Social (S-2200, S-2205, S-2230, S-1200, S-1210, S-2299)
    dados.eventosEsocial.forEach((evt) => {
      const isTransmitido = evt.status === 'transmitido' || evt.status === 'fechado'
      const isRejeitado = evt.status === 'rejeitado'
      const nomeEvento: Record<string, string> = {
        'S-2200': 'S-2200 Admissão / Início de Vínculo',
        'S-2205': 'S-2205 Alteração de Dados Cadastrais',
        'S-2230': 'S-2230 Afastamento Temporário (Férias/Licença)',
        'S-1200': 'S-1200 Remuneração de Trabalhador',
        'S-1210': 'S-1210 Pagamentos de Rendimentos do Trabalho',
        'S-2299': 'S-2299 Desligamento / Rescisão',
        'S-1299': 'S-1299 Fechamento de Eventos Periódicos',
      }
      const titulo = nomeEvento[evt.tipo_evento] || `e-Social ${evt.tipo_evento}`
      const desc = isTransmitido
        ? `Transmitido com sucesso no e-Social. Recibo: ${evt.recibo_entrega || evt.protocolo_envio || 'Confirmado'}.`
        : isRejeitado
          ? `Transmissão rejeitada pelo ambiente de governo. ${Array.isArray(evt.erros_validacao) && evt.erros_validacao.length > 0 ? evt.erros_validacao[0]?.mensagem : 'Verifique inconsistências cadastrais.'}`
          : `Evento em fila (${evt.status.toUpperCase()}) para competência ${evt.competencia || 'atual'}.`

      itens.push({
        id: `esocial-${evt.id}`,
        data: evt.data_transmissao || evt.created,
        titulo: `e-Social ${evt.tipo_evento} — ${isTransmitido ? 'Transmitido' : evt.status.toUpperCase()}`,
        descricaoCurta: desc,
        categoria: 'esocial',
        status: evt.status,
        badgeTexto: evt.status.toUpperCase(),
        badgeVariant: isTransmitido ? 'success' : isRejeitado ? 'destructive' : 'warning',
        detalhes: {
          tipo_evento: evt.tipo_evento,
          status: evt.status,
          protocolo: evt.protocolo_envio,
          recibo: evt.recibo_entrega,
          identificador: evt.identificador_evento,
          prazo_legal: evt.prazo_legal,
          erros: evt.erros_validacao,
        },
        referenciaOrigem: {
          tipo: 'evento_esocial',
          id: evt.id,
          xml: evt.xml_gerado,
          protocolo: evt.recibo_entrega || evt.protocolo_envio,
        },
      })
    })

    // 8. Eventos DP Registrados
    dados.eventosDp.forEach((ev) => {
      // Evitar duplicar admissão se for o registro original
      if (ev.tipo === 'admissao' && dados.funcionario.data_admissao) {
        return
      }
      const tipoNome: Record<string, string> = {
        admissao: 'Admissão',
        demissao: 'Demissão / Rescisão',
        ferias: 'Férias Registradas',
        afastado: 'Afastamento Médico / INSS',
        alteracao_salarial: 'Alteração Salarial',
      }
      itens.push({
        id: `eventodp-${ev.id}`,
        data: ev.data_evento || ev.created,
        titulo: `Ocorrência DP: ${tipoNome[ev.tipo] || ev.tipo}`,
        descricaoCurta: ev.descricao,
        categoria:
          ev.tipo === 'ferias'
            ? 'ferias'
            : ev.tipo === 'afastado'
              ? 'afastamento'
              : ev.tipo === 'alteracao_salarial'
                ? 'alteracao_salarial'
                : ev.tipo === 'demissao'
                  ? 'rescisao'
                  : 'admissao',
        status: 'concluido',
        badgeTexto: 'DP',
        badgeVariant: 'secondary',
        detalhes: {
          tipo: ev.tipo,
          descricao: ev.descricao,
        },
        referenciaOrigem: {
          tipo: 'evento_dp',
          id: ev.id,
        },
      })
    })

    // 9. Rescisão (se houver)
    if (dados.rescisao) {
      const r = dados.rescisao
      const isConcluida = r.status === 'concluida'
      const dtPagtoLimite = r.prazo_pagamento_limite ? new Date(r.prazo_pagamento_limite) : null
      const isAtrasado = dtPagtoLimite && dtPagtoLimite.getTime() < agora.getTime() && !isConcluida

      // Item do desligamento
      itens.push({
        id: `rescisao-${r.id}`,
        data: r.data_desligamento || r.created,
        titulo: `Desligamento / Rescisão (${r.motivo_desligamento.replace(/_/g, ' ')})`,
        descricaoCurta: `Total Líquido TRCT: R$ ${Number(r.total_liquido_rescisao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Multa FGTS 40%: R$ ${Number(r.valor_multa_rescisoria_fgts || 0).toFixed(2)}) • Aviso prévio de ${r.dias_aviso_previo} dias (${r.tipo_aviso_previo}).`,
        categoria: 'rescisao',
        status: r.status,
        badgeTexto: isConcluida ? 'Concluída / Homologada' : 'Simulada / Pendente',
        badgeVariant: isConcluida ? 'destructive' : 'warning',
        detalhes: {
          motivo: r.motivo_desligamento,
          dataDesligamento: r.data_desligamento,
          prazoArt477: r.prazo_pagamento_limite,
          bruto: r.total_bruto_rescisao,
          liquido: r.total_liquido_rescisao,
          multaFgts: r.valor_multa_rescisoria_fgts,
          saqueFgts: r.saque_fgts_autorizado,
          codigoSaque: r.codigo_saque_fgts,
          alertas: r.alertas_conformidade_clt,
        },
        referenciaOrigem: {
          tipo: 'rescisao',
          id: r.id,
        },
      })

      // Se pendente de pagamento, exibir item "previsto" com o prazo do art. 477 da CLT
      if (r.prazo_pagamento_limite && !isConcluida) {
        itens.push({
          id: `prazo-477-${r.id}`,
          data: r.prazo_pagamento_limite,
          titulo: 'Prazo Limite de Quitação TRCT (Art. 477 §6º CLT)',
          descricaoCurta: `Prazo fatal de 10 dias corridos para pagamento das verbas rescisórias sob pena de multa de 1 salário (R$ ${Number(r.salario_base || 0).toFixed(2)}).`,
          categoria: 'aviso_previo',
          status: isAtrasado ? 'atrasado' : 'previsto',
          isPrevisto: true,
          badgeTexto: isAtrasado ? 'Prazo Vencido' : 'Prazo Previsto',
          badgeVariant: isAtrasado ? 'destructive' : 'outline',
          detalhes: {
            prazoLimite: r.prazo_pagamento_limite,
            salarioBase: r.salario_base,
          },
        })
      }
    }

    // Ordenar itens da timeline em ordem decrescente (mais recente no topo)
    itens.sort((a, b) => {
      const timeA = new Date(a.data).getTime() || 0
      const timeB = new Date(b.data).getTime() || 0
      return timeB - timeA
    })

    return itens
  },
}

import pb from '@/lib/pocketbase/client'
import { auditService } from './audit'
import { dpService } from './dp'
import type {
  ConvencaoColetivaRecord,
  ConvencaoStatusVigencia,
  HistoricoSalarialRecord,
  ParametroAdicionalConvencao,
  Funcionario,
  VerbaCatalogoRecord,
} from '@/types'

export interface CreateConvencaoInput {
  tenant_id: string
  empresa: string
  titulo: string
  sindicato_laboral: string
  sindicato_patronal?: string
  categoria_profissional: string
  numero_registro_mte?: string
  data_base: string
  vigencia_inicio: string
  vigencia_fim: string
  arquivo_pdf?: string
  piso_salarial?: number
  percentual_reajuste?: number
  data_aplicacao_reajuste?: string
  adicional_hora_extra?: number
  adicional_noturno?: number
  adicional_insalubridade_minimo?: number
  ticket_refeicao_diario?: number
  auxilio_creche?: number
  parametros_adicionais_json?: ParametroAdicionalConvencao[]
  status_vigencia?: ConvencaoStatusVigencia
  alerta_dias_config?: number
  observacoes?: string
}

export interface ImpactoReajusteColaborador {
  funcionarioId: string
  nomeCompleto: string
  cargo: string
  salarioAtual: number
  salarioNovo: number
  diferencaMensal: number
  percentualReajuste: number
  enquadradoPiso: boolean
  retroativoSugerido: number
  mesesRetroativos: number
}

export interface EstimativaImpactoReajuste {
  convencao: ConvencaoColetivaRecord
  totalColaboradores: number
  custoAdicionalMensal: number
  custoRetroativoTotal: number
  colaboradoresImpactados: ImpactoReajusteColaborador[]
  verbasAtualizadasCatalogo: {
    codigo: string
    descricao: string
    valorAnterior: number
    valorNovo: number
  }[]
  competenciaAfetada: string
  avisoLegal: string
}

export interface ResultadoAplicacaoFolha {
  loteId: string
  colaboradoresAtualizados: number
  custoAdicionalMensal: number
  custoRetroativoTotal: number
  folhaRecalculada: boolean
  verbasAtualizadas: number
}

export const convencoesService = {
  /**
   * Avalia dinamicamente o status de vigência de uma convenção coletiva com base na data final
   */
  calcularStatusVigencia(
    vigenciaFim: string,
    diasAlertaConfig: number = 60,
  ): {
    status: ConvencaoStatusVigencia
    diasRestantes: number
    isVencida: boolean
    corBadge: 'verde' | 'amarelo' | 'vermelho'
  } {
    if (!vigenciaFim) {
      return { status: 'vigente', diasRestantes: 999, isVencida: false, corBadge: 'verde' }
    }

    const agora = new Date()
    const fim = new Date(vigenciaFim)
    const diffMs = fim.getTime() - agora.getTime()
    const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diasRestantes <= 0) {
      return { status: 'vencida', diasRestantes, isVencida: true, corBadge: 'vermelho' }
    }
    if (diasRestantes <= 7) {
      return { status: 'a_vencer_7', diasRestantes, isVencida: false, corBadge: 'vermelho' }
    }
    if (diasRestantes <= 30) {
      return { status: 'a_vencer_30', diasRestantes, isVencida: false, corBadge: 'amarelo' }
    }
    if (diasRestantes <= diasAlertaConfig) {
      return { status: 'a_vencer_60', diasRestantes, isVencida: false, corBadge: 'amarelo' }
    }
    return { status: 'vigente', diasRestantes, isVencida: false, corBadge: 'verde' }
  },

  async listConvencoes(tenantId: string, empresaId?: string): Promise<ConvencaoColetivaRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`]
    if (empresaId && empresaId !== 'todas') {
      parts.push(`empresa = "${empresaId}"`)
    }

    const items = await pb.collection('convencoes_coletivas').getFullList<ConvencaoColetivaRecord>({
      filter: parts.join(' && '),
      sort: 'vigencia_fim',
      expand: 'empresa',
    })

    // Atualiza visualmente o status de vigência com cálculo de dias em tempo real
    return items.map((c) => {
      const calc = this.calcularStatusVigencia(c.vigencia_fim, c.alerta_dias_config || 60)
      return {
        ...c,
        status_vigencia: calc.status,
      }
    })
  },

  async getConvencao(id: string): Promise<ConvencaoColetivaRecord> {
    return pb.collection('convencoes_coletivas').getOne<ConvencaoColetivaRecord>(id, {
      expand: 'empresa',
    })
  },

  async createConvencao(
    data: CreateConvencaoInput,
    usuarioId: string,
  ): Promise<ConvencaoColetivaRecord> {
    const calc = this.calcularStatusVigencia(data.vigencia_fim, data.alerta_dias_config || 60)
    const rec = await pb.collection('convencoes_coletivas').create<ConvencaoColetivaRecord>(
      {
        ...data,
        status_vigencia: data.status_vigencia || calc.status,
      },
      { expand: 'empresa' },
    )

    await auditService.log(
      data.tenant_id,
      usuarioId,
      'convencao_coletiva_cadastrada',
      'convencoes_coletivas',
      rec.id,
      `Convenção Coletiva "${rec.titulo}" cadastrada para a empresa. Monitoramento de vigência iniciado.`,
    )

    return rec
  },

  async updateConvencao(
    id: string,
    data: Partial<CreateConvencaoInput>,
    usuarioId: string,
  ): Promise<ConvencaoColetivaRecord> {
    if (data.vigencia_fim) {
      const calc = this.calcularStatusVigencia(data.vigencia_fim, data.alerta_dias_config || 60)
      data.status_vigencia = calc.status
    }

    const rec = await pb
      .collection('convencoes_coletivas')
      .update<ConvencaoColetivaRecord>(id, data, {
        expand: 'empresa',
      })

    await auditService.log(
      rec.tenant_id,
      usuarioId,
      'convencao_coletiva_atualizada',
      'convencoes_coletivas',
      rec.id,
      `Convenção Coletiva "${rec.titulo}" atualizada.`,
    )

    return rec
  },

  async deleteConvencao(id: string, usuarioId: string): Promise<boolean> {
    const rec = await pb.collection('convencoes_coletivas').getOne<ConvencaoColetivaRecord>(id)
    await pb.collection('convencoes_coletivas').delete(id)

    await auditService.log(
      rec.tenant_id,
      usuarioId,
      'convencao_coletiva_excluida',
      'convencoes_coletivas',
      id,
      `Convenção Coletiva "${rec.titulo}" removida.`,
    )

    return true
  },

  // === HISTÓRICO SALARIAL & AUDITORIA ===
  async listHistoricoSalarial(
    tenantId: string,
    filters?: {
      empresaId?: string
      funcionarioId?: string
      loteId?: string
    },
  ): Promise<HistoricoSalarialRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`]
    if (filters?.empresaId && filters.empresaId !== 'todas') {
      parts.push(`empresa = "${filters.empresaId}"`)
    }
    if (filters?.funcionarioId && filters.funcionarioId !== 'todos') {
      parts.push(`funcionario = "${filters.funcionarioId}"`)
    }
    if (filters?.loteId) {
      parts.push(`lote_reajuste_id = "${filters.loteId}"`)
    }

    return pb.collection('historico_salarial').getFullList<HistoricoSalarialRecord>({
      filter: parts.join(' && '),
      sort: '-data_alteracao',
      expand: 'empresa,funcionario,convencao_origem',
    })
  },

  /**
   * Estima o impacto do reajuste da convenção coletiva ANTES da aplicação efetiva na folha.
   * Apura:
   * (a) Novos salários por colaborador ativo (aplicando reajuste % e garantindo piso salarial)
   * (b) Diferença salarial retroativa se a data de aplicação for anterior à competência atual
   * (c) Atualizações automáticas que serão refletidas nas verbas do catálogo (HE, Noturno)
   */
  async simularImpactoReajuste(
    tenantId: string,
    convencaoId: string,
    competenciaFolhaAtual: string,
  ): Promise<EstimativaImpactoReajuste> {
    const cct = await this.getConvencao(convencaoId)
    const funcs = await dpService.listFuncionarios(tenantId, {
      empresaId: cct.empresa,
      status: 'ativo',
    })

    const percReajuste = cct.percentual_reajuste || 0
    const piso = cct.piso_salarial || 0
    const dataAplicacao = cct.data_aplicacao_reajuste
      ? new Date(cct.data_aplicacao_reajuste)
      : new Date()

    // Calcular meses de retroativo (se data da convenção for anterior à folha atual)
    // Exemplo: dataAplicacao em 01/05/2026 e competência atual 09/2026 -> 4 meses de diferença retroativa
    const [mesAtualStr, anoAtualStr] = competenciaFolhaAtual.split('/')
    const mesAtual = parseInt(mesAtualStr, 10)
    const anoAtual = parseInt(anoAtualStr, 10)
    const mesAplicacao = dataAplicacao.getMonth() + 1
    const anoAplicacao = dataAplicacao.getFullYear()

    let mesesRetroativos = 0
    if (anoAtual > anoAplicacao) {
      mesesRetroativos = (anoAtual - anoAplicacao) * 12 + (mesAtual - mesAplicacao)
    } else if (anoAtual === anoAplicacao && mesAtual > mesAplicacao) {
      mesesRetroativos = mesAtual - mesAplicacao
    }
    mesesRetroativos = Math.max(0, mesesRetroativos)

    let custoAdicionalMensal = 0
    let custoRetroativoTotal = 0
    const colaboradoresImpactados: ImpactoReajusteColaborador[] = []

    for (const f of funcs) {
      const salAtual = f.salario || 0
      if (salAtual <= 0) continue

      // Reajuste percentual
      let salComReajuste = Number((salAtual * (1 + percReajuste / 100)).toFixed(2))
      let enquadradoPiso = false

      // Se o salário recalculado ficar abaixo do piso da categoria, sobe para o piso
      if (piso > 0 && salComReajuste < piso) {
        salComReajuste = piso
        enquadradoPiso = true
      }

      const diffMensal = Number((salComReajuste - salAtual).toFixed(2))
      const retroativo = Number((diffMensal * mesesRetroativos).toFixed(2))

      custoAdicionalMensal += diffMensal
      custoRetroativoTotal += retroativo

      colaboradoresImpactados.push({
        funcionarioId: f.id,
        nomeCompleto: f.nome_completo,
        cargo: f.cargo,
        salarioAtual: salAtual,
        salarioNovo: salComReajuste,
        diferencaMensal: diffMensal,
        percentualReajuste: percReajuste,
        enquadradoPiso,
        retroativoSugerido: retroativo,
        mesesRetroativos,
      })
    }

    // Buscar verbas do catálogo que serão atualizadas em cascata
    const verbasAtuais = await pb.collection('verbas_catalogo').getFullList<VerbaCatalogoRecord>({
      filter: `tenant_id = "${tenantId}" && empresa = "${cct.empresa}"`,
    })

    const verbasAtualizadasCatalogo: {
      codigo: string
      descricao: string
      valorAnterior: number
      valorNovo: number
    }[] = []

    if (cct.adicional_hora_extra) {
      const vHe = verbasAtuais.find((v) => v.codigo === '1020')
      if (vHe && vHe.valor_padrao !== cct.adicional_hora_extra) {
        verbasAtualizadasCatalogo.push({
          codigo: vHe.codigo,
          descricao: vHe.descricao,
          valorAnterior: vHe.valor_padrao || 50,
          valorNovo: cct.adicional_hora_extra,
        })
      }
    }

    if (cct.adicional_noturno) {
      const vNot = verbasAtuais.find((v) => v.codigo === '1030')
      if (vNot && vNot.valor_padrao !== cct.adicional_noturno) {
        verbasAtualizadasCatalogo.push({
          codigo: vNot.codigo,
          descricao: vNot.descricao,
          valorAnterior: vNot.valor_padrao || 20,
          valorNovo: cct.adicional_noturno,
        })
      }
    }

    const avisoLegal =
      'Padrão de Transparência Rumo: O sistema monitora a vigência e alerta preventivamente. Os novos parâmetros foram parametrizados pelo contador com base no instrumento coletivo registrado. A aplicação altera salários, verbas e recalcula a folha em cascata, com registro de auditoria reversível.'

    return {
      convencao: cct,
      totalColaboradores: colaboradoresImpactados.length,
      custoAdicionalMensal: Number(custoAdicionalMensal.toFixed(2)),
      custoRetroativoTotal: Number(custoRetroativoTotal.toFixed(2)),
      colaboradoresImpactados,
      verbasAtualizadasCatalogo,
      competenciaAfetada: competenciaFolhaAtual,
      avisoLegal,
    }
  },

  /**
   * ATUALIZAR FOLHA COM 1 CLIQUE
   * Executa a aplicação em cascata:
   * (a) Atualiza salário base dos colaboradores + cria registro detalhado em historico_salarial
   * (b) Atualiza parâmetros nas verbas do catálogo (ex: nova alíquota HE ou adicional noturno da CCT)
   * (c) Se houver diferença salarial retroativa, pode gerar o lançamento sugerido da diferença
   * (d) Recalcula a folha da competência afetada
   * (e) Registra tudo na trilha de auditoria
   */
  async aplicarParametrosFolha1Clique(
    tenantId: string,
    convencaoId: string,
    competenciaFolhaAtual: string,
    usuarioId: string,
    aplicarRetroativoLancamento: boolean = true,
  ): Promise<ResultadoAplicacaoFolha> {
    const simulacao = await this.simularImpactoReajuste(
      tenantId,
      convencaoId,
      competenciaFolhaAtual,
    )
    const cct = simulacao.convencao
    const loteId = 'LOTE-CCT-' + Date.now().toString(36).toUpperCase()
    const nowISO = new Date().toISOString()

    // 1. Atualizar colaboradores e registrar histórico
    for (const item of simulacao.colaboradoresImpactados) {
      // Registrar no histórico salarial para auditoria e rollback
      await pb.collection('historico_salarial').create({
        tenant_id: tenantId,
        empresa: cct.empresa,
        funcionario: item.funcionarioId,
        convencao_origem: cct.id,
        data_alteracao: nowISO,
        competencia_vigencia: competenciaFolhaAtual,
        motivo: item.enquadradoPiso ? 'enquadramento_piso' : 'reajuste_convencao_coletiva',
        salario_anterior: item.salarioAtual,
        salario_novo: item.salarioNovo,
        percentual_aplicado: item.percentualReajuste,
        diferenca_mensal: item.diferencaMensal,
        retroativo_sugerido: item.retroativoSugerido,
        meses_retroativos: item.mesesRetroativos,
        lote_reajuste_id: loteId,
        revertido: false,
        detalhes_json: {
          convencao_titulo: cct.titulo,
          sindicato: cct.sindicato_laboral,
          cargo: item.cargo,
        },
      })

      // Atualizar o cadastro do colaborador
      await pb.collection('funcionarios').update(item.funcionarioId, {
        salario: item.salarioNovo,
      })

      // Registrar evento no histórico de DP do colaborador
      try {
        await pb.collection('eventos_dp').create({
          tenant_id: tenantId,
          empresa: cct.empresa,
          funcionario: item.funcionarioId,
          tipo: 'alteracao_salarial',
          data_evento: nowISO,
          descricao: `Reajuste salarial CCT 1-Clique (${cct.titulo}): De R$ ${item.salarioAtual.toFixed(2)} para R$ ${item.salarioNovo.toFixed(2)} (+R$ ${item.diferencaMensal.toFixed(2)}/mês). Lote: ${loteId}`,
        })
      } catch {
        /* intentionally ignored */
      }

      // Lançar diferença salarial retroativa se houver e estiver habilitado
      if (aplicarRetroativoLancamento && item.retroativoSugerido > 0) {
        try {
          // Localizar verba de provento geral ou criar lançamento
          const verbaProvento = await pb
            .collection('verbas_catalogo')
            .getFullList<VerbaCatalogoRecord>({
              filter: `tenant_id = "${tenantId}" && empresa = "${cct.empresa}" && tipo = "provento"`,
            })
          if (verbaProvento.length > 0) {
            await pb.collection('verbas_lancamentos').create({
              tenant_id: tenantId,
              empresa: cct.empresa,
              funcionario: item.funcionarioId,
              verba: verbaProvento[0].id,
              competencia: competenciaFolhaAtual,
              quantidade: item.mesesRetroativos,
              valor_calculado: item.retroativoSugerido,
              referencia_detalhe: `Diferença Salarial Retroativa CCT (${item.mesesRetroativos} meses retroativos pactuados)`,
            })
          }
        } catch (errRetro) {
          console.warn('Erro ao lançar retroativo sugerido:', errRetro)
        }
      }
    }

    // 2. Atualizar parâmetros no catálogo de verbas
    let verbasAtualizadas = 0
    for (const vUpd of simulacao.verbasAtualizadasCatalogo) {
      try {
        const vRecs = await pb.collection('verbas_catalogo').getFullList<VerbaCatalogoRecord>({
          filter: `tenant_id = "${tenantId}" && empresa = "${cct.empresa}" && codigo = "${vUpd.codigo}"`,
        })
        if (vRecs.length > 0) {
          await pb.collection('verbas_catalogo').update(vRecs[0].id, {
            valor_padrao: vUpd.valorNovo,
          })
          verbasAtualizadas++
        }
      } catch {
        /* intentionally ignored */
      }
    }

    // 3. Atualizar carimbo da última aplicação na convenção
    await pb.collection('convencoes_coletivas').update(cct.id, {
      ultima_aplicacao_em: nowISO,
    })

    // 4. Recalcular a folha de pagamento da competência para refletir os novos valores
    let folhaRecalculada = false
    try {
      for (const item of simulacao.colaboradoresImpactados) {
        await dpService.recalcularFolhaFuncionario(
          tenantId,
          cct.empresa,
          item.funcionarioId,
          competenciaFolhaAtual,
        )
      }
      folhaRecalculada = true
    } catch (errRecalc) {
      console.warn('Erro ao recalcular folhas após reajuste CCT:', errRecalc)
    }

    // 5. Auditoria de ponta a ponta
    await auditService.log(
      tenantId,
      usuarioId,
      'reajuste_cct_1_clique_aplicado',
      'convencoes_coletivas',
      cct.id,
      `Reajuste em 1 clique aplicado para "${cct.titulo}". Lote: ${loteId}. ${simulacao.totalColaboradores} colaboradores reajustados. Custo mensal adicional: R$ ${simulacao.custoAdicionalMensal.toFixed(2)}.`,
    )

    return {
      loteId,
      colaboradoresAtualizados: simulacao.totalColaboradores,
      custoAdicionalMensal: simulacao.custoAdicionalMensal,
      custoRetroativoTotal: simulacao.custoRetroativoTotal,
      folhaRecalculada,
      verbasAtualizadas,
    }
  },

  /**
   * ROLLBACK / REVERSÃO DE REAJUSTE EM MASSA
   * Desfaz a aplicação de um lote, restaurando os salários anteriores dos colaboradores.
   */
  async reverterReajusteLote(
    tenantId: string,
    loteId: string,
    competenciaFolha: string,
    usuarioId: string,
  ): Promise<{ revertidos: number; sucesso: boolean }> {
    const historicos = await pb
      .collection('historico_salarial')
      .getFullList<HistoricoSalarialRecord>({
        filter: `tenant_id = "${tenantId}" && lote_reajuste_id = "${loteId}" && revertido = false`,
      })

    if (historicos.length === 0) {
      return { revertidos: 0, sucesso: false }
    }

    const nowISO = new Date().toISOString()
    let revertidos = 0

    for (const h of historicos) {
      // Restaurar salário anterior no cadastro do funcionário
      await pb.collection('funcionarios').update(h.funcionario, {
        salario: h.salario_anterior,
      })

      // Marcar registro como revertido
      await pb.collection('historico_salarial').update(h.id, {
        revertido: true,
        data_reversao: nowISO,
      })

      // Recalcular a folha do colaborador
      try {
        await dpService.recalcularFolhaFuncionario(
          tenantId,
          h.empresa,
          h.funcionario,
          competenciaFolha,
        )
      } catch {
        /* intentionally ignored */
      }

      revertidos++
    }

    await auditService.log(
      tenantId,
      usuarioId,
      'reajuste_cct_revertido',
      'historico_salarial',
      loteId,
      `Reversão (Rollback) executada com sucesso para o lote ${loteId}. ${revertidos} colaboradores restaurados ao salário anterior.`,
    )

    return { revertidos, sucesso: true }
  },
}

import pb from '@/lib/pocketbase/client'
import { auditService } from './audit'
import {
  calcularFeriasClt,
  calcularDecimoTerceiroClt,
  calcularRescisaoClt,
  apurarMediasVerbasVariaveis,
  type ParametrosCalculoFerias,
  type ParametrosCalculoDecimo,
  type ParametrosCalculoRescisao,
} from '@/lib/calculoClt'
import type {
  FeriasPeriodoRecord,
  DecimoTerceiroRecord,
  RescisaoRecord,
  Funcionario,
  VerbaLancamentoRecord,
  VerbaCatalogoRecord,
  ItemMapaMedia,
} from '@/types'

export interface CreateFeriasInput {
  tenant_id: string
  empresa: string
  funcionario: string
  competencia: string
  periodo_aquisitivo_inicio: string
  periodo_aquisitivo_fim: string
  data_inicio_gozo: string
  data_fim_gozo: string
  dias_gozo: number
  vender_abono: boolean
  dias_abono?: number
  adiantar_13?: boolean
  observacoes?: string
}

export interface CreateDecimoInput {
  tenant_id: string
  empresa: string
  funcionario: string
  ano: number
  competencia: string
  parcela: 'primeira_parcela' | 'segunda_parcela' | 'parcela_unica'
  meses_trabalhados?: number
  salario_maternidade_meses?: number
  observacoes?: string
}

export interface CreateRescisaoInput {
  tenant_id: string
  empresa: string
  funcionario: string
  motivo_desligamento:
    | 'sem_justa_causa_empregador'
    | 'justa_causa_empregador'
    | 'pedido_demissao'
    | 'acordo_consensual_art_484_a'
    | 'termino_contrato_experiencia'
    | 'rescisao_indireta'
    | 'aposentadoria'
  tipo_aviso_previo: 'trabalhado' | 'indenizado' | 'dispensado' | 'nao_aplicavel'
  data_aviso_previo?: string
  data_desligamento: string
  ferias_vencidas?: boolean
  saldo_fgts?: number
  desconto_adiantamento?: number
  outros_proventos?: number
  outros_descontos?: number
  observacoes?: string
}

export const calculosTrabalhistasService = {
  // === 1. FÉRIAS ===
  async listFerias(
    tenantId: string,
    filters?: { empresaId?: string; funcionarioId?: string; competencia?: string; status?: string },
  ): Promise<FeriasPeriodoRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`]
    if (filters?.empresaId && filters.empresaId !== 'todas')
      parts.push(`empresa = "${filters.empresaId}"`)
    if (filters?.funcionarioId && filters.funcionarioId !== 'todos')
      parts.push(`funcionario = "${filters.funcionarioId}"`)
    if (filters?.competencia && filters.competencia !== 'todas')
      parts.push(`competencia = "${filters.competencia}"`)
    if (filters?.status && filters.status !== 'todos') parts.push(`status = "${filters.status}"`)

    return pb.collection('ferias_periodos').getFullList<FeriasPeriodoRecord>({
      filter: parts.join(' && '),
      sort: '-created',
      expand: 'empresa,funcionario',
    })
  },

  async apurarMediasFuncionario(
    tenantId: string,
    empresaId: string,
    funcionarioId: string,
  ): Promise<{ media: number; itens: ItemMapaMedia[] }> {
    const lancs = await pb.collection('verbas_lancamentos').getFullList<VerbaLancamentoRecord>({
      filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && funcionario = "${funcionarioId}"`,
      expand: 'verba',
    })

    const apuracao = apurarMediasVerbasVariaveis({
      lancamentos: lancs.map((l) => ({
        ...l,
        verbaObj: l.expand?.verba as VerbaCatalogoRecord | undefined,
      })),
      mesesDivisor: 12,
    })

    return {
      media: apuracao.mediaApurada,
      itens: apuracao.itensDetalhados,
    }
  },

  async simularFerias(
    tenantId: string,
    empresaId: string,
    funcionarioId: string,
    params: {
      diasGozo: number
      venderAbono: boolean
      diasAbono?: number
      adiantar13?: boolean
    },
  ) {
    const func = await pb.collection('funcionarios').getOne<Funcionario>(funcionarioId)
    const { media, itens } = await this.apurarMediasFuncionario(tenantId, empresaId, funcionarioId)

    const calc = calcularFeriasClt({
      salarioBase: func.salario || 0,
      diasGozo: params.diasGozo,
      venderAbono: params.venderAbono,
      diasAbono: params.diasAbono,
      dependentes: func.dependentes_irrf || 0,
      mediaVariaveis: media,
      adiantar13: params.adiantar13,
    })

    return { ...calc, itensMapaMedias: itens }
  },

  async criarCalculoFerias(
    data: CreateFeriasInput,
    usuarioId: string,
  ): Promise<FeriasPeriodoRecord> {
    const func = await pb.collection('funcionarios').getOne<Funcionario>(data.funcionario)
    const { media, itens } = await this.apurarMediasFuncionario(
      data.tenant_id,
      data.empresa,
      data.funcionario,
    )

    const calc = calcularFeriasClt({
      salarioBase: func.salario || 0,
      diasGozo: data.dias_gozo,
      venderAbono: data.vender_abono,
      diasAbono: data.dias_abono,
      dependentes: func.dependentes_irrf || 0,
      mediaVariaveis: media,
      adiantar13: data.adiantar_13,
    })

    // CLT art. 145: Prazo de pagamento até 2 dias antes do início do gozo
    const dtGozo = new Date(data.data_inicio_gozo)
    const dtLimite = new Date(dtGozo.getTime() - 2 * 24 * 60 * 60 * 1000)

    const payload = {
      tenant_id: data.tenant_id,
      empresa: data.empresa,
      funcionario: data.funcionario,
      competencia: data.competencia,
      periodo_aquisitivo_inicio: new Date(
        `${data.periodo_aquisitivo_inicio}T00:00:00Z`,
      ).toISOString(),
      periodo_aquisitivo_fim: new Date(`${data.periodo_aquisitivo_fim}T00:00:00Z`).toISOString(),
      data_inicio_gozo: new Date(`${data.data_inicio_gozo}T00:00:00Z`).toISOString(),
      data_fim_gozo: new Date(`${data.data_fim_gozo}T00:00:00Z`).toISOString(),
      dias_gozo: data.dias_gozo,
      vender_abono: data.vender_abono,
      dias_abono: calc.diasAbono,
      adiantar_13: data.adiantar_13 || false,
      salario_base: calc.salarioBase,
      media_variaveis: calc.mediaVariaveis,
      remuneracao_base_ferias: calc.remuneracaoBase,
      valor_ferias_gozo: calc.valorFeriasGozo,
      terco_constitucional_ferias: calc.tercoConstitucionalFerias,
      valor_abono_pecuniario: calc.valorAbonoPecuniario,
      terco_constitucional_abono: calc.tercoConstitucionalAbono,
      total_bruto: calc.totalBruto,
      base_inss: calc.baseInss,
      inss: calc.inss,
      base_irrf: calc.baseIrrf,
      irrf: calc.irrf,
      total_descontos: calc.totalDescontos,
      total_liquido: calc.totalLiquido,
      data_limite_pagamento: dtLimite.toISOString(),
      mapa_medias_json: itens,
      status: 'calculado',
      integrado_folha: false,
      observacoes: data.observacoes || undefined,
    }

    const rec = await pb.collection('ferias_periodos').create<FeriasPeriodoRecord>(payload, {
      expand: 'empresa,funcionario',
    })

    await auditService.log(
      data.tenant_id,
      usuarioId,
      'ferias_calculadas',
      'ferias_periodos',
      rec.id,
      `Férias calculadas para ${func.nome_completo}: ${data.dias_gozo} dias de gozo (Líquido: R$ ${calc.totalLiquido.toFixed(2)}).`,
    )

    return rec
  },

  async marcarFeriasPaga(id: string, usuarioId: string): Promise<FeriasPeriodoRecord> {
    const current = await pb.collection('ferias_periodos').getOne<FeriasPeriodoRecord>(id, {
      expand: 'funcionario,empresa',
    })
    const now = new Date().toISOString()
    const updated = await pb.collection('ferias_periodos').update<FeriasPeriodoRecord>(id, {
      status: 'pago',
      pago_em: now,
      integrado_folha: true,
    })

    // Atualizar status do colaborador para 'ferias' e criar evento DP
    try {
      await pb.collection('funcionarios').update(current.funcionario, { status: 'ferias' })
      await pb.collection('eventos_dp').create({
        tenant_id: current.tenant_id,
        empresa: current.empresa,
        funcionario: current.funcionario,
        tipo: 'ferias',
        data_evento: current.data_inicio_gozo,
        descricao: `Início do período de gozo de férias (${current.dias_gozo} dias) - Quitado R$ ${current.total_liquido.toFixed(2)}`,
      })
    } catch (e) {
      console.warn('Erro ao atualizar funcionário para férias:', e)
    }

    await auditService.log(
      current.tenant_id,
      usuarioId,
      'ferias_pagas',
      'ferias_periodos',
      id,
      `Férias de ${current.expand?.funcionario?.nome_completo} quitadas e integradas à Folha.`,
    )

    return updated
  },

  // === 2. 13º SALÁRIO ===
  async listDecimo(
    tenantId: string,
    filters?: { empresaId?: string; funcionarioId?: string; ano?: number; status?: string },
  ): Promise<DecimoTerceiroRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`]
    if (filters?.empresaId && filters.empresaId !== 'todas')
      parts.push(`empresa = "${filters.empresaId}"`)
    if (filters?.funcionarioId && filters.funcionarioId !== 'todos')
      parts.push(`funcionario = "${filters.funcionarioId}"`)
    if (filters?.ano) parts.push(`ano = ${filters.ano}`)
    if (filters?.status && filters.status !== 'todos') parts.push(`status = "${filters.status}"`)

    return pb.collection('decimo_terceiro').getFullList<DecimoTerceiroRecord>({
      filter: parts.join(' && '),
      sort: '-created',
      expand: 'empresa,funcionario',
    })
  },

  async apurarAvosDecimoFuncionario(
    dataAdmissaoStr: string,
    anoReferencia: number,
  ): Promise<number> {
    const dtAdm = new Date(dataAdmissaoStr)
    const anoAdm = dtAdm.getFullYear()

    if (anoAdm > anoReferencia) return 0
    if (anoAdm < anoReferencia) return 12

    // Admitido no ano de referência: contar meses onde trabalhou >= 15 dias (CLT art. 146 §único)
    const mesAdm = dtAdm.getMonth() + 1
    const diasNoMes = 30 - dtAdm.getDate() + 1
    const avoAdm = diasNoMes >= 15 ? 1 : 0
    const mesesRestantes = 12 - mesAdm
    return Math.min(12, Math.max(1, mesesRestantes + avoAdm))
  },

  async criarCalculoDecimo(
    data: CreateDecimoInput,
    usuarioId: string,
  ): Promise<DecimoTerceiroRecord> {
    const func = await pb.collection('funcionarios').getOne<Funcionario>(data.funcionario)
    const { media, itens } = await this.apurarMediasFuncionario(
      data.tenant_id,
      data.empresa,
      data.funcionario,
    )

    const avos =
      data.meses_trabalhados !== undefined
        ? data.meses_trabalhados
        : await this.apurarAvosDecimoFuncionario(func.data_admissao, data.ano)

    // Se for 2ª parcela, buscar adiantamento já pago na 1ª parcela
    let adiantamentoJaPago = 0
    if (data.parcela === 'segunda_parcela') {
      try {
        const anteriores = await pb
          .collection('decimo_terceiro')
          .getFullList<DecimoTerceiroRecord>({
            filter: `tenant_id = "${data.tenant_id}" && empresa = "${data.empresa}" && funcionario = "${data.funcionario}" && ano = ${data.ano} && parcela = "primeira_parcela"`,
          })
        if (anteriores.length > 0) {
          adiantamentoJaPago = anteriores[0].valor_bruto || 0
        }
      } catch (e) {
        console.warn('Erro ao consultar 1ª parcela de 13º:', e)
      }
    }

    const calc = calcularDecimoTerceiroClt({
      salarioBase: func.salario || 0,
      mesesTrabalhados: avos,
      parcela: data.parcela,
      mediaVariaveis: media,
      adiantamentoJaPago,
      dependentes: func.dependentes_irrf || 0,
      salarioMaternidadeMeses: data.salario_maternidade_meses || 0,
    })

    const payload = {
      tenant_id: data.tenant_id,
      empresa: data.empresa,
      funcionario: data.funcionario,
      ano: data.ano,
      competencia: data.competencia,
      parcela: data.parcela,
      meses_trabalhados: avos,
      salario_base: calc.salarioBase,
      media_variaveis: calc.mediaVariaveis,
      salario_maternidade_abatimento: calc.salarioMaternidadeAbatimento,
      remuneracao_base_calculo: calc.remuneracaoBase,
      valor_bruto: calc.valorBrutoParcela,
      adiantamento_pago: calc.adiantamentoDescontado,
      base_inss: calc.baseInss,
      inss: calc.inss,
      base_irrf: calc.baseIrrf,
      irrf: calc.irrf,
      fgts: calc.fgts,
      total_descontos: calc.totalDescontos,
      total_liquido: calc.totalLiquido,
      mapa_medias_json: itens,
      codigo_receita_inss: '2172',
      vencimento_guia_inss: `${data.ano}-12-20T23:59:59Z`,
      status: 'calculado',
      integrado_folha: false,
      observacoes: data.observacoes || undefined,
    }

    const rec = await pb.collection('decimo_terceiro').create<DecimoTerceiroRecord>(payload, {
      expand: 'empresa,funcionario',
    })

    await auditService.log(
      data.tenant_id,
      usuarioId,
      'decimo_terceiro_calculado',
      'decimo_terceiro',
      rec.id,
      `13º Salário (${data.parcela}) calculado para ${func.nome_completo} (Líquido: R$ ${calc.totalLiquido.toFixed(2)}).`,
    )

    return rec
  },

  async marcarDecimoPago(id: string, usuarioId: string): Promise<DecimoTerceiroRecord> {
    const current = await pb.collection('decimo_terceiro').getOne<DecimoTerceiroRecord>(id, {
      expand: 'funcionario,empresa',
    })
    const now = new Date().toISOString()
    const updated = await pb.collection('decimo_terceiro').update<DecimoTerceiroRecord>(id, {
      status: 'pago',
      pago_em: now,
      integrado_folha: true,
    })

    await auditService.log(
      current.tenant_id,
      usuarioId,
      'decimo_terceiro_pago',
      'decimo_terceiro',
      id,
      `13º Salário (${current.parcela}) de ${current.expand?.funcionario?.nome_completo} liquidado com sucesso.`,
    )

    return updated
  },

  // === 3. RESCISÃO DE CONTRATO ===
  async listRescisoes(
    tenantId: string,
    filters?: { empresaId?: string; funcionarioId?: string; status?: string },
  ): Promise<RescisaoRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`]
    if (filters?.empresaId && filters.empresaId !== 'todas')
      parts.push(`empresa = "${filters.empresaId}"`)
    if (filters?.funcionarioId && filters.funcionarioId !== 'todos')
      parts.push(`funcionario = "${filters.funcionarioId}"`)
    if (filters?.status && filters.status !== 'todos') parts.push(`status = "${filters.status}"`)

    return pb.collection('rescisoes').getFullList<RescisaoRecord>({
      filter: parts.join(' && '),
      sort: '-created',
      expand: 'empresa,funcionario,concluido_por',
    })
  },

  async simularRescisao(data: CreateRescisaoInput) {
    const func = await pb.collection('funcionarios').getOne<Funcionario>(data.funcionario)
    const { media, itens } = await this.apurarMediasFuncionario(
      data.tenant_id,
      data.empresa,
      data.funcionario,
    )

    const calc = calcularRescisaoClt({
      salarioBase: func.salario || 0,
      dataAdmissao: func.data_admissao
        ? func.data_admissao.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      dataDesligamento: data.data_desligamento,
      motivoDesligamento: data.motivo_desligamento,
      tipoAvisoPrevio: data.tipo_aviso_previo,
      dataAvisoPrevio: data.data_aviso_previo,
      mediaVariaveis: media,
      dependentes: func.dependentes_irrf || 0,
      feriasVencidas: data.ferias_vencidas,
      saldoFgts: data.saldo_fgts || 0,
      descontoAdiantamento: data.desconto_adiantamento || 0,
      outrosProventos: data.outros_proventos || 0,
      outrosDescontos: data.outros_descontos || 0,
    })

    return { ...calc, mapaMedias: itens }
  },

  async criarRescisao(data: CreateRescisaoInput, usuarioId: string): Promise<RescisaoRecord> {
    const func = await pb.collection('funcionarios').getOne<Funcionario>(data.funcionario)
    const sim = await this.simularRescisao(data)

    // Mapeamento e-Social S-2299 código de motivo
    let codEsocial = '02'
    if (data.motivo_desligamento === 'justa_causa_empregador') codEsocial = '01'
    else if (data.motivo_desligamento === 'pedido_demissao') codEsocial = '07'
    else if (data.motivo_desligamento === 'acordo_consensual_art_484_a') codEsocial = '33'
    else if (data.motivo_desligamento === 'termino_contrato_experiencia') codEsocial = '04'
    else if (data.motivo_desligamento === 'rescisao_indireta') codEsocial = '03'
    else if (data.motivo_desligamento === 'aposentadoria') codEsocial = '09'

    const payload = {
      tenant_id: data.tenant_id,
      empresa: data.empresa,
      funcionario: data.funcionario,
      motivo_desligamento: data.motivo_desligamento,
      codigo_afastamento_esocial: codEsocial,
      data_aviso_previo: data.data_aviso_previo
        ? new Date(`${data.data_aviso_previo}T00:00:00Z`).toISOString()
        : undefined,
      tipo_aviso_previo: data.tipo_aviso_previo,
      dias_aviso_previo: sim.diasAvisoPrevioLei12506,
      data_desligamento: new Date(`${data.data_desligamento}T00:00:00Z`).toISOString(),
      data_projecao_aviso: new Date(`${sim.dataProjecaoAviso}T00:00:00Z`).toISOString(),
      dias_saldo_salario: sim.diasSaldoSalario,
      salario_base: func.salario || 0,
      media_variaveis: mediaVariaveisFromItens(sim.mapaMedias),
      saldo_salario_valor: sim.saldoSalarioValor,
      aviso_previo_indenizado_valor: sim.avisoPrevioIndenizadoValor,
      decimo_terceiro_proporcional_valor: sim.decimoTerceiroProporcionalValor,
      decimo_terceiro_indenizado_aviso: sim.decimoTerceiroIndenizadoAviso,
      ferias_vencidas_valor: sim.feriasVencidasValor,
      terco_ferias_vencidas: sim.tercoFeriasVencidas,
      ferias_proporcionais_valor: sim.feriasProporcionaisValor,
      terco_ferias_proporcionais: sim.tercoFeriasProporcionais,
      ferias_indenizadas_aviso: sim.feriasIndenizadasAviso,
      salario_familia_proporcional: 0,
      outros_proventos: data.outros_proventos || 0,
      total_bruto_rescisao: sim.totalBrutoRescisao,
      desconto_inss: sim.descontoInss,
      desconto_irrf: sim.descontoIrrf,
      desconto_aviso_previo_nao_cumprido: sim.descontoAvisoNaoCumprido,
      desconto_adiantamento: sim.descontoAdiantamento,
      outros_descontos: sim.outrosDescontos,
      total_descontos_rescisao: sim.totalDescontosRescisao,
      total_liquido_rescisao: sim.totalLiquidoRescisao,
      saldo_fgts_para_fins_rescisorios: data.saldo_fgts || 0,
      aliquota_multa_fgts: sim.aliquotaMultaFgts,
      valor_multa_rescisoria_fgts: sim.valorMultaFgts,
      saque_fgts_autorizado: sim.saqueFgtsAutorizado,
      codigo_saque_fgts: sim.codigoSaqueFgts,
      prazo_pagamento_limite: new Date(`${sim.prazoPagamentoLimite}T23:59:59Z`).toISOString(),
      alertas_conformidade_clt: sim.alertasConformidade,
      mapa_medias_json: sim.mapaMedias,
      verbas_rescisorias_detalhadas: sim.rubricasDetalhadas,
      status: 'simulada',
      observacoes: data.observacoes || undefined,
    }

    const rec = await pb.collection('rescisoes').create<RescisaoRecord>(payload, {
      expand: 'empresa,funcionario',
    })

    await auditService.log(
      data.tenant_id,
      usuarioId,
      'rescisao_simulada',
      'rescisoes',
      rec.id,
      `Rescisão simulada para ${func.nome_completo} (Motivo: ${data.motivo_desligamento}, Líquido: R$ ${sim.totalLiquidoRescisao.toFixed(2)}).`,
    )

    return rec
  },

  async concluirRescisao(id: string, usuarioId: string): Promise<RescisaoRecord> {
    const resc = await pb.collection('rescisoes').getOne<RescisaoRecord>(id, {
      expand: 'funcionario,empresa',
    })
    const now = new Date().toISOString()

    // 1. Desligar colaborador no cadastro oficial de funcionários
    await pb.collection('funcionarios').update(resc.funcionario, {
      status: 'demitido',
      data_demissao: resc.data_desligamento,
    })

    // 2. Criar evento de demissão em eventos_dp
    try {
      await pb.collection('eventos_dp').create({
        tenant_id: resc.tenant_id,
        empresa: resc.empresa,
        funcionario: resc.funcionario,
        tipo: 'demissao',
        data_evento: resc.data_desligamento,
        descricao: `Desligamento oficial homologado (${resc.motivo_desligamento}). Líquido rescisório: R$ ${resc.total_liquido_rescisao.toFixed(2)} (Prazo quitação: ${resc.prazo_pagamento_limite?.slice(0, 10)})`,
      })
    } catch (e) {
      console.warn('Erro ao registrar evento_dp de demissão:', e)
    }

    // 3. Gerar evento pendente S-2299 na fila do e-Social
    let eventoEsocialId = ''
    try {
      const funcNome = resc.expand?.funcionario?.nome_completo || 'Colaborador'
      const compRescisao = resc.data_desligamento
        ? `${resc.data_desligamento.slice(5, 7)}/${resc.data_desligamento.slice(0, 4)}`
        : '09/2026'

      const esEvent = await pb.collection('esocial_eventos').create({
        tenant_id: resc.tenant_id,
        empresa: resc.empresa,
        funcionario: resc.funcionario,
        tipo_evento: 'S-2299',
        competencia: compRescisao,
        status: 'pendente',
        identificador_evento: `ID1${Date.now()}S2299`,
        prazo_legal: resc.prazo_pagamento_limite,
        xml_gerado: `<eSocial><evtDesligamento><ideEmpregador><tpInsc>1</tpInsc></ideEmpregador><ideTrabalhador><cpfTrab>${resc.expand?.funcionario?.cpf || ''}</cpfTrab></ideTrabalhador><infoDesligamento><dtDeslig>${resc.data_desligamento.slice(0, 10)}</dtDeslig><mtvDeslig>${resc.codigo_afastamento_esocial}</mtvDeslig><verbasResc><totBruto>${resc.total_bruto_rescisao.toFixed(2)}</totBruto><totLiquido>${resc.total_liquido_rescisao.toFixed(2)}</totLiquido></verbasResc></infoDesligamento></evtDesligamento></eSocial>`,
        erros_validacao: [],
        modo_envio: 'supervisao',
        justificativa: `Evento de Desligamento S-2299 gerado automaticamente para ${funcNome} (TRCT homologado).`,
      })
      eventoEsocialId = esEvent.id
    } catch (errEs) {
      console.warn('Erro ao enfileirar evento e-Social S-2299:', errEs)
    }

    // 4. Atualizar registro de rescisão para 'concluida'
    const updated = await pb.collection('rescisoes').update<RescisaoRecord>(id, {
      status: 'concluida',
      concluido_em: now,
      concluido_por: usuarioId,
      evento_s2299_gerado_id: eventoEsocialId,
      chave_conectividade_emitida: resc.saque_fgts_autorizado === true,
    })

    await auditService.log(
      resc.tenant_id,
      usuarioId,
      'rescisao_homologada',
      'rescisoes',
      id,
      `Rescisão de ${resc.expand?.funcionario?.nome_completo} homologada com sucesso. Evento S-2299 gerado na fila e-Social e colaborador desligado.`,
    )

    return updated
  },

  async deleteRescisao(id: string, usuarioId: string): Promise<boolean> {
    const resc = await pb.collection('rescisoes').getOne<RescisaoRecord>(id)
    await pb.collection('rescisoes').delete(id)

    await auditService.log(
      resc.tenant_id,
      usuarioId,
      'rescisao_excluida',
      'rescisoes',
      id,
      `Registro de rescisão removido.`,
    )

    return true
  },
}

function mediaVariaveisFromItens(itens: ItemMapaMedia[] = []): number {
  if (itens.length === 0) return 0
  const sum = itens.reduce((acc, c) => acc + (c.valor || 0), 0)
  return Number((sum / 12).toFixed(2))
}

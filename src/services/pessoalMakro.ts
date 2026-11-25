/**
 * Serviço da Fatia 5 — Pessoal (Departamento Pessoal e SST) do modelo Makro.
 *
 * Reutiliza os motores de cálculo de src/lib/calculoClt.ts (INSS progressivo,
 * IRRF por tabela, FGTS 8%, 13º, rescisão e folha) e os serviços existentes
 * (verbasService, esocialService, convencoesService). Nenhuma collection nova:
 * todas já existem com RLS por tenant (funcionarios, folha_pagamento,
 * verbas_*, ferias_periodos, decimo_terceiro, rescisoes, eventos_dp,
 * convencoes_coletivas, historico_salarial, beneficios_concedidos,
 * esocial_config/eventos, guias_pagamentos).
 */

import pb from '@/lib/pocketbase/client'
import {
  processarCalculoFolhaClt,
  calcularDecimoTerceiroClt,
  calcularRescisaoClt,
  calcularInssProgressivo,
  calcularIrrfProgressivo,
} from '@/lib/calculoClt'
import type {
  Funcionario,
  FolhaPagamento,
  EventoDp,
  EsocialEventoRecord,
  EsocialConfigRecord,
  VerbaCatalogoRecord,
  VerbaLancamentoRecord,
  FeriasPeriodoRecord,
  DecimoTerceiroRecord,
  DecimoTerceiroParcela,
  RescisaoRecord,
  RescisaoMotivo,
  AvisoPrevioTipo,
  ConvencaoColetivaRecord,
  GuiaPagamentoRecord,
  AlertaConformidadeClt,
  ItemRubrica,
} from '@/types'
import { verbasService } from '@/services/verbas'
import { esocialService } from '@/services/esocial'
import type { ParametrosCalculoRescisao } from '@/lib/calculoClt'

const FERIAS_PROPORCIONALIDADE_DIAS = 30
const DIAS_ANO = 365

// ============================================================
// Helpers internos
// ============================================================

function toNum(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0
}

function somaDias(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T12:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

function diaDaSemana(dataISO: string): number {
  return new Date(`${dataISO}T12:00:00`).getDay() // 0 dom, 6 sáb
}

function diffDias(dataISOA: string, dataISOB: string): number {
  const a = new Date(`${dataISOA}T12:00:00`).getTime()
  const b = new Date(`${dataISOB}T12:00:00`).getTime()
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}

export function competenciaAtual(): string {
  const d = new Date()
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function competenciaAnterior(competencia: string): string {
  const [mes, ano] = competencia.split('/').map(Number)
  const m = mes - 1
  return m === 0 ? `12/${ano - 1}` : `${String(m).padStart(2, '0')}/${ano}`
}

// ============================================================
// Colaboradores
// ============================================================

export interface FuncionarioMakroInput {
  empresa: string
  nome_completo: string
  cpf: string
  cargo: string
  cbo?: string
  data_admissao: string
  salario: number
  tipo: 'clt' | 'pj' | 'estagio'
  status?: 'ativo' | 'demitido' | 'ferias' | 'afastado'
  ctps_numero?: string
  ctps_serie?: string
  ctps_uf?: string
  grau_instrucao?: string
  dependentes_irrf?: number
  matricula_esocial?: string
  centro_custo?: string
}

export interface AlertaPessoal {
  tipo: 'aviso' | 'infracao' | 'informativo' | 'sucesso'
  titulo: string
  mensagem: string
  funcionario_id?: string
  funcionario_nome?: string
}

export const pessoalMakro = {
  // ---------- Colaboradores ----------
  async listarFuncionarios(tenantId: string, empresaId?: string): Promise<Funcionario[]> {
    const parts = [`tenant_id = "${tenantId}"`]
    if (empresaId && empresaId !== 'todas') parts.push(`empresa = "${empresaId}"`)
    return pb.collection('funcionarios').getFullList<Funcionario>({
      filter: parts.join(' && '),
      sort: 'nome_completo',
      expand: 'empresa',
    })
  },

  async criarFuncionario(tenantId: string, input: FuncionarioMakroInput): Promise<Funcionario> {
    const func = await pb.collection('funcionarios').create<Funcionario>({
      tenant_id: tenantId,
      ...input,
      status: input.status || 'ativo',
      dependentes_irrf: toNum(input.dependentes_irrf),
    })
    try {
      await pb.collection('eventos_dp').create<EventoDp>({
        tenant_id: tenantId,
        empresa: input.empresa,
        funcionario: func.id,
        tipo: 'admissao',
        data_evento: input.data_admissao,
        descricao: `Admissão de ${input.nome_completo} — cargo ${input.cargo} (CBO ${input.cbo || 'não informado'}), salário R$ ${input.salario.toFixed(2)}`,
      })
    } catch {
      // evento de admissão é best-effort
    }
    return func
  },

  async atualizarFuncionario(id: string, dados: Partial<Funcionario>): Promise<Funcionario> {
    return pb.collection('funcionarios').update<Funcionario>(id, dados)
  },

  async excluirFuncionario(id: string): Promise<void> {
    await pb.collection('funcionarios').delete(id)
  },

  async registrarEventoDp(
    tenantId: string,
    empresaId: string,
    dados: {
      funcionario: string
      tipo: EventoDp['tipo']
      data_evento: string
      descricao: string
    },
  ): Promise<EventoDp> {
    return pb.collection('eventos_dp').create<EventoDp>({
      tenant_id: tenantId,
      empresa: empresaId,
      ...dados,
    })
  },

  async listarEventosDp(tenantId: string, empresaId?: string): Promise<EventoDp[]> {
    const parts = [`tenant_id = "${tenantId}"`]
    if (empresaId && empresaId !== 'todas') parts.push(`empresa = "${empresaId}"`)
    return pb.collection('eventos_dp').getFullList<EventoDp>({
      filter: parts.join(' && '),
      sort: '-data_evento,-created',
      expand: 'funcionario',
    })
  },

  // ---------- Rubricas (verbas) ----------
  async listarVerbas(tenantId: string, empresaId?: string): Promise<VerbaCatalogoRecord[]> {
    return verbasService.listCatalogo(
      tenantId,
      empresaId && empresaId !== 'todas' ? empresaId : undefined,
    )
  },

  async criarVerba(
    tenantId: string,
    empresaId: string,
    dados: Omit<
      VerbaCatalogoRecord,
      'id' | 'created' | 'updated' | 'tenant_id' | 'empresa' | 'expand'
    >,
    usuarioId?: string,
  ): Promise<VerbaCatalogoRecord> {
    return verbasService.createVerbaCatalogo(
      {
        ...dados,
        tenant_id: tenantId,
        empresa: empresaId,
      },
      usuarioId || tenantId,
    )
  },

  async atualizarVerba(
    id: string,
    dados: Partial<VerbaCatalogoRecord>,
    contexto?: { tenantId?: string; usuarioId?: string },
  ): Promise<VerbaCatalogoRecord> {
    const auditId = contexto?.usuarioId || contexto?.tenantId
    if (!auditId) {
      throw new Error(
        'atualizarVerba requer contexto com tenantId ou usuarioId para trilha de auditoria.',
      )
    }
    return verbasService.updateVerbaCatalogo(id, dados, auditId)
  },

  // ---------- Lançamentos de verbas por competência ----------
  async listarLancamentos(
    tenantId: string,
    competencia: string,
    empresaId?: string,
  ): Promise<VerbaLancamentoRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`, `competencia = "${competencia}"`]
    if (empresaId && empresaId !== 'todas') parts.push(`empresa = "${empresaId}"`)
    return pb.collection('verbas_lancamentos').getFullList<VerbaLancamentoRecord>({
      filter: parts.join(' && '),
      expand: 'verba',
    })
  },

  async lancarVerba(
    tenantId: string,
    empresaId: string,
    dados: {
      funcionario: string
      verba: string
      competencia: string
      quantidade?: number
      aliquota_percentual?: number
      valor_calculado: number
      referencia_detalhe?: string
    },
  ): Promise<VerbaLancamentoRecord> {
    return pb.collection('verbas_lancamentos').create<VerbaLancamentoRecord>({
      tenant_id: tenantId,
      empresa: empresaId,
      ...dados,
    })
  },

  async excluirLancamento(id: string): Promise<void> {
    await pb.collection('verbas_lancamentos').delete(id)
  },

  // ---------- Folha mensal ----------
  async listarFolha(
    tenantId: string,
    competencia: string,
    empresaId?: string,
  ): Promise<FolhaPagamento[]> {
    const parts = [`tenant_id = "${tenantId}"`, `competencia = "${competencia}"`]
    if (empresaId && empresaId !== 'todas') parts.push(`empresa = "${empresaId}"`)
    return pb.collection('folha_pagamento').getFullList<FolhaPagamento>({
      filter: parts.join(' && '),
      expand: 'funcionario',
    })
  },

  /**
   * Calcula (ou recalcula) a folha da competência. Colaboradores com status
   * afastado/ferias/demitido são suspensos da folha (regra automática).
   */
  async calcularFolha(
    tenantId: string,
    empresaId: string,
    competencia: string,
    funcionarios: Funcionario[],
    lancamentos: VerbaLancamentoRecord[],
  ): Promise<FolhaPagamento[]> {
    const porFuncionario = new Map<string, VerbaLancamentoRecord[]>()
    for (const l of lancamentos) {
      const arr = porFuncionario.get(l.funcionario) || []
      arr.push(l)
      porFuncionario.set(l.funcionario, arr)
    }

    const existentes = await this.listarFolha(tenantId, competencia, empresaId)
    const existentesPorFunc = new Map(existentes.map((f) => [f.funcionario, f]))
    const processados: FolhaPagamento[] = []
    const suspensos = funcionarios.filter(
      (f) => f.status === 'afastado' || f.status === 'ferias' || f.status === 'demitido',
    )

    for (const func of funcionarios) {
      if (func.tipo !== 'clt') continue
      if (func.status === 'afastado' || func.status === 'ferias' || func.status === 'demitido') {
        const existente = existentesPorFunc.get(func.id)
        if (existente && existente.status === 'rascunho') {
          await pb.collection('folha_pagamento').delete(existente.id)
        }
        continue
      }

      const res = processarCalculoFolhaClt({
        salarioBase: toNum(func.salario),
        dependentes: toNum(func.dependentes_irrf),
        lancamentos: (porFuncionario.get(func.id) || []).map((l) => ({
          ...l,
          verbaObj: l.expand?.verba,
        })),
      })

      const payload = {
        tenant_id: tenantId,
        empresa: empresaId,
        funcionario: func.id,
        competencia,
        salario_base: res.salarioBase,
        proventos: res.proventosDetalhados,
        descontos: res.descontosDetalhados,
        inss: res.inss,
        irrf: res.irrf,
        fgts: res.fgts,
        total_liquido: res.salarioLiquido,
        status: 'rascunho' as const,
      }

      const existente = existentesPorFunc.get(func.id)
      const salvo = existente
        ? await pb.collection('folha_pagamento').update<FolhaPagamento>(existente.id, payload)
        : await pb.collection('folha_pagamento').create<FolhaPagamento>(payload)
      processados.push(salvo)
    }

    for (const s of suspensos) {
      console.info(
        `[Pessoal] ${s.nome_completo} suspenso da folha ${competencia} (status: ${s.status})`,
      )
    }
    return processados
  },

  async marcarFolhaPaga(id: string): Promise<FolhaPagamento> {
    return pb.collection('folha_pagamento').update<FolhaPagamento>(id, {
      status: 'paga',
      pago_em: new Date().toISOString().slice(0, 10),
    })
  },

  async adiantamentoSalarial(
    tenantId: string,
    empresaId: string,
    competencia: string,
    funcionarios: Funcionario[],
    percentual: number,
  ): Promise<{ criados: number; alertas: AlertaPessoal[] }> {
    const alertas: AlertaPessoal[] = []
    let criados = 0
    for (const func of funcionarios) {
      if (func.status === 'demitido' || func.status === 'afastado') continue
      const valor = Number(((toNum(func.salario) * percentual) / 100).toFixed(2))
      try {
        await this.lancarVerba(tenantId, empresaId, {
          funcionario: func.id,
          verba: '',
          competencia,
          valor_calculado: -valor, // adiantamento descontado na folha
          referencia_detalhe: `Adiantamento ${percentual}% do salário`,
        })
        criados++
      } catch {
        alertas.push({
          tipo: 'aviso',
          titulo: 'Adiantamento não lançado',
          mensagem: `Falha ao lançar adiantamento para ${func.nome_completo}. Verifique a verba de adiantamento no catálogo de rubricas.`,
          funcionario_id: func.id,
          funcionario_nome: func.nome_completo,
        })
      }
    }
    return { criados, alertas }
  },

  // ---------- 13º Salário ----------
  async listarDecimo(
    tenantId: string,
    ano: number,
    empresaId?: string,
  ): Promise<DecimoTerceiroRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`, `ano = ${ano}`]
    if (empresaId && empresaId !== 'todas') parts.push(`empresa = "${empresaId}"`)
    return pb.collection('decimo_terceiro').getFullList<DecimoTerceiroRecord>({
      filter: parts.join(' && '),
      expand: 'funcionario',
    })
  },

  async calcularDecimo(
    tenantId: string,
    empresaId: string,
    funcionario: Funcionario,
    ano: number,
    parcela: DecimoTerceiroParcela,
    mesesTrabalhados: number,
    adiantamentoJaPago = 0,
  ): Promise<DecimoTerceiroRecord> {
    const dependentes = toNum(funcionario.dependentes_irrf)
    const res = calcularDecimoTerceiroClt({
      salarioBase: toNum(funcionario.salario),
      mesesTrabalhados,
      parcela,
      adiantamentoJaPago,
      dependentes,
    })

    const competenciaParcela =
      parcela === 'primeira_parcela'
        ? `11/${ano}`
        : parcela === 'segunda_parcela'
          ? `12/${ano}`
          : `${String(ano).slice(-2) === ano.toString().slice(-2) ? '12' : '12'}/${ano}`

    const payload = {
      tenant_id: tenantId,
      empresa: empresaId,
      funcionario: funcionario.id,
      ano,
      competencia: competenciaParcela,
      parcela,
      meses_trabalhados: res.mesesTrabalhados,
      salario_base: res.salarioBase,
      remuneracao_base_calculo: res.remuneracaoBase,
      valor_bruto: res.valorBrutoParcela,
      adiantamento_pago: res.adiantamentoDescontado,
      base_inss: res.baseInss,
      inss: res.inss,
      base_irrf: res.baseIrrf,
      irrf: res.irrf,
      fgts: res.fgts,
      total_descontos: res.totalDescontos,
      total_liquido: res.totalLiquido,
      status: 'calculado' as const,
    }

    const existentes = await pb.collection('decimo_terceiro').getFullList<DecimoTerceiroRecord>({
      filter: `tenant_id = "${tenantId}" && funcionario = "${funcionario.id}" && ano = ${ano} && parcela = "${parcela}"`,
    })
    if (existentes.length > 0) {
      return pb
        .collection('decimo_terceiro')
        .update<DecimoTerceiroRecord>(existentes[0].id, payload)
    }
    return pb.collection('decimo_terceiro').create<DecimoTerceiroRecord>(payload)
  },

  // ---------- Férias ----------
  async listarFerias(tenantId: string, empresaId?: string): Promise<FeriasPeriodoRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`]
    if (empresaId && empresaId !== 'todas') parts.push(`empresa = "${empresaId}"`)
    return pb.collection('ferias_periodos').getFullList<FeriasPeriodoRecord>({
      filter: parts.join(' && '),
      sort: '-data_inicio_gozo',
      expand: 'funcionario',
    })
  },

  /** Validação preventiva de gozo de férias (CLT art. 134 e 137). */
  validarGozoFerias(params: {
    dataInicioGozo: string
    diasGozo: number
    permitirGozoIrregular?: boolean
  }): { valido: boolean; bloqueios: string[]; alertas: AlertaConformidadeClt[] } {
    const { dataInicioGozo, diasGozo, permitirGozoIrregular } = params
    const bloqueios: string[] = []
    const alertas: AlertaConformidadeClt[] = []
    const dow = diaDaSemana(dataInicioGozo)
    const dataFim = somaDias(dataInicioGozo, diasGozo)
    const dowFim = diaDaSemana(dataFim)

    if (diasGozo > 30) {
      bloqueios.push('Gozo não pode exceder 30 dias corridos (CLT art. 134 §1º).')
    }
    if (diasGozo > 0 && diasGozo < 5) {
      bloqueios.push('Gozo fracionado exige período mínimo de 5 dias corridos (CLT art. 134 §1º).')
    }

    // Início às vésperas de folga semanal (sábado véspera de domingo)
    if (dow === 6) {
      alertas.push({
        tipo: 'aviso',
        regra: 'Boa prática CLT art. 134',
        mensagem:
          'Início do gozo em sábado antecipa o descanso remunerado. Prefira iniciar em dia útil.',
        sugestao: permitirGozoIrregular
          ? 'Autorização sindical registrada — liberado excepcionalmente.'
          : 'Ajuste a data de início para um dia útil ou registre permissão sindical.',
      })
      if (!permitirGozoIrregular) {
        bloqueios.push(
          'Início do gozo em dia que antecede o descanso semanal remunerado (sábado) exige permissão sindical expressa (CLT art. 134 §2º).',
        )
      }
    }
    if (dow === 0 || dow === 6) {
      if (!permitirGozoIrregular) {
        bloqueios.push('Gozo não pode iniciar em domingo ou sábado sem autorização sindical.')
      }
    }

    // Fim do gozo também não deve cair no descanso (recomendação prática)
    if (dowFim === 6 || dowFim === 0) {
      alertas.push({
        tipo: 'informativo',
        regra: 'Boa prática',
        mensagem: `Fim do gozo (${dataFim}) recai em ${dowFim === 0 ? 'domingo' : 'sábado'}. Considere ajustar para o dia útil seguinte.`,
      })
    }

    return { valido: bloqueios.length === 0, bloqueios, alertas }
  },

  async calcularFerias(
    tenantId: string,
    empresaId: string,
    funcionario: Funcionario,
    dados: {
      competencia: string
      periodo_aquisitivo_inicio: string
      periodo_aquisitivo_fim: string
      data_inicio_gozo: string
      dias_gozo: number
      vender_abono: boolean
      dias_abono?: number
      adiantar_13: boolean
      media_variaveis?: number
    },
  ): Promise<{ registro: FeriasPeriodoRecord; alertas: AlertaConformidadeClt[] }> {
    const remuneracaoBase = Number(
      (toNum(funcionario.salario) + toNum(dados.media_variaveis)).toFixed(2),
    )
    const valorGozo = Number(
      ((remuneracaoBase * dados.dias_gozo) / FERIAS_PROPORCIONALIDADE_DIAS).toFixed(2),
    )
    const tercoGozo = Number((valorGozo / 3).toFixed(2))
    const diasAbono = dados.vender_abono ? toNum(dados.dias_abono) || 10 : 0
    const abonoValor = Number(
      ((remuneracaoBase * diasAbono) / FERIAS_PROPORCIONALIDADE_DIAS).toFixed(2),
    )
    const tercoAbono = Number((abonoValor / 3).toFixed(2))

    const baseInss = valorGozo + tercoGozo // férias integram INSS quando pagas na folha
    const resInss = calcularInssProgressivo(baseInss)
    const resIrrf = calcularIrrfProgressivo({
      baseBrutaParaIrrf: baseInss,
      inssDescontado: resInss.inss,
      dependentes: toNum(funcionario.dependentes_irrf),
    })
    const totalBruto = valorGozo + tercoGozo + abonoValor + tercoAbono
    const totalDescontos = resInss.inss + resIrrf.irrf
    const totalLiquido = Number(Math.max(0, totalBruto - totalDescontos).toFixed(2))

    // Validação preventiva do gozo
    const validar = this.validarGozoFerias({
      dataInicioGozo: dados.data_inicio_gozo,
      diasGozo: dados.dias_gozo,
    })
    if (!validar.valido) {
      throw new Error(validar.bloqueios.join(' '))
    }

    // Data limite de pagamento: até 2 dias antes do início do gozo (CLT art. 145)
    const dataLimitePagamento = somaDias(dados.data_inicio_gozo, -2)
    const dataFimGozo = somaDias(dados.data_inicio_gozo, dados.dias_gozo)

    const payload = {
      tenant_id: tenantId,
      empresa: empresaId,
      funcionario: funcionario.id,
      competencia: dados.competencia,
      periodo_aquisitivo_inicio: dados.periodo_aquisitivo_inicio,
      periodo_aquisitivo_fim: dados.periodo_aquisitivo_fim,
      data_inicio_gozo: dados.data_inicio_gozo,
      data_fim_gozo: dataFimGozo,
      dias_gozo: dados.dias_gozo,
      vender_abono: dados.vender_abono,
      dias_abono: diasAbono,
      adiantar_13: dados.adiantar_13,
      salario_base: toNum(funcionario.salario),
      media_variaveis: toNum(dados.media_variaveis),
      remuneracao_base_ferias: remuneracaoBase,
      valor_ferias_gozo: valorGozo,
      terco_constitucional_ferias: tercoGozo,
      valor_abono_pecuniario: abonoValor,
      terco_constitucional_abono: tercoAbono,
      total_bruto: Number(totalBruto.toFixed(2)),
      base_inss: baseInss,
      inss: resInss.inss,
      base_irrf: resIrrf.baseCalculo,
      irrf: resIrrf.irrf,
      total_descontos: Number(totalDescontos.toFixed(2)),
      total_liquido: totalLiquido,
      data_limite_pagamento: dataLimitePagamento,
      status: 'calculado' as const,
    }

    const registro = await pb
      .collection('ferias_periodos')
      .create<FeriasPeriodoRecord>(payload as unknown as Record<string, unknown>)
    await pb.collection('eventos_dp').create<EventoDp>({
      tenant_id: tenantId,
      empresa: empresaId,
      funcionario: funcionario.id,
      tipo: 'ferias',
      data_evento: dados.data_inicio_gozo,
      descricao: `Férias de ${funcionario.nome_completo}: ${dados.dias_gozo} dias (${dados.data_inicio_gozo} a ${dataFimGozo})${dados.vender_abono ? `, abono de ${diasAbono} dias` : ''}`,
    })
    try {
      await pb.collection('funcionarios').update(funcionario.id, { status: 'ferias' })
    } catch {
      // status é best-effort
    }
    return { registro, alertas: validar.alertas }
  },

  // ---------- Rescisão ----------
  async listarRescisoes(tenantId: string, empresaId?: string): Promise<RescisaoRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`]
    if (empresaId && empresaId !== 'todas') parts.push(`empresa = "${empresaId}"`)
    return pb.collection('rescisoes').getFullList<RescisaoRecord>({
      filter: parts.join(' && '),
      sort: '-data_desligamento',
      expand: 'funcionario',
    })
  },

  /** Simulador de rescisão (não grava) — usa o motor calcularRescisaoClt. */
  simularRescisao(params: {
    funcionario: Funcionario
    motivoDesligamento: RescisaoMotivo
    dataDesligamento: string
    tipoAvisoPrevio: AvisoPrevioTipo
    dataAvisoPrevio?: string
    feriasVencidas?: boolean
    saldoFgts?: number
    descontoAdiantamento?: number
    mediaVariaveis?: number
  }): ReturnType<typeof calcularRescisaoClt> {
    const entrada: ParametrosCalculoRescisao = {
      salarioBase: toNum(params.funcionario.salario),
      dataAdmissao: (params.funcionario.data_admissao || '').slice(0, 10),
      dataDesligamento: params.dataDesligamento,
      motivoDesligamento: params.motivoDesligamento,
      tipoAvisoPrevio: params.tipoAvisoPrevio,
      dataAvisoPrevio: params.dataAvisoPrevio,
      mediaVariaveis: toNum(params.mediaVariaveis),
      dependentes: toNum(params.funcionario.dependentes_irrf),
      feriasVencidas: params.feriasVencidas,
      saldoFgts: toNum(params.saldoFgts),
      descontoAdiantamento: toNum(params.descontoAdiantamento),
    }
    return calcularRescisaoClt(entrada)
  },

  async concluirRescisao(
    tenantId: string,
    empresaId: string,
    funcionario: Funcionario,
    simulacao: ReturnType<typeof calcularRescisaoClt>,
    dados: {
      motivo_desligamento: RescisaoMotivo
      data_desligamento: string
      tipo_aviso_previo: AvisoPrevioTipo
      data_aviso_previo?: string
      codigo_afastamento_esocial?: string
      observacoes?: string
    },
  ): Promise<RescisaoRecord> {
    const codigoAfastamento = dados.codigo_afastamento_esocial || 'I30'
    const payload = {
      tenant_id: tenantId,
      empresa: empresaId,
      funcionario: funcionario.id,
      motivo_desligamento: dados.motivo_desligamento,
      codigo_afastamento_esocial: codigoAfastamento,
      data_aviso_previo: dados.data_aviso_previo,
      tipo_aviso_previo: dados.tipo_aviso_previo,
      dias_aviso_previo: simulacao.diasAvisoPrevioLei12506,
      data_desligamento: dados.data_desligamento,
      data_projecao_aviso: simulacao.dataProjecaoAviso,
      dias_saldo_salario: simulacao.diasSaldoSalario,
      salario_base: toNum(funcionario.salario),
      saldo_salario_valor: simulacao.saldoSalarioValor,
      aviso_previo_indenizado_valor: simulacao.avisoPrevioIndenizadoValor,
      decimo_terceiro_proporcional_valor: simulacao.decimoTerceiroProporcionalValor,
      decimo_terceiro_indenizado_aviso: simulacao.decimoTerceiroIndenizadoAviso,
      ferias_vencidas_valor: simulacao.feriasVencidasValor,
      terco_ferias_vencidas: simulacao.tercoFeriasVencidas,
      ferias_proporcionais_valor: simulacao.feriasProporcionaisValor,
      terco_ferias_proporcionais: simulacao.tercoFeriasProporcionais,
      ferias_indenizadas_aviso: simulacao.feriasIndenizadasAviso,
      total_bruto_rescisao: simulacao.totalBrutoRescisao,
      desconto_inss: simulacao.descontoInss,
      desconto_irrf: simulacao.descontoIrrf,
      desconto_aviso_previo_nao_cumprido: simulacao.descontoAvisoNaoCumprido,
      desconto_adiantamento: simulacao.descontoAdiantamento,
      total_descontos_rescisao: simulacao.totalDescontosRescisao,
      total_liquido_rescisao: simulacao.totalLiquidoRescisao,
      aliquota_multa_fgts: simulacao.aliquotaMultaFgts,
      valor_multa_rescisoria_fgts: simulacao.valorMultaFgts,
      saque_fgts_autorizado: simulacao.saqueFgtsAutorizado,
      codigo_saque_fgts: simulacao.codigoSaqueFgts,
      prazo_pagamento_limite: simulacao.prazoPagamentoLimite,
      alertas_conformidade_clt: simulacao.alertasConformidade,
      verbas_rescisorias_detalhadas: simulacao.rubricasDetalhadas,
      status: 'concluida' as const,
      concluido_em: new Date().toISOString(),
      observacoes: dados.observacoes,
    }

    const registro = await pb.collection('rescisoes').create<RescisaoRecord>(payload)
    await pb.collection('eventos_dp').create<EventoDp>({
      tenant_id: tenantId,
      empresa: empresaId,
      funcionario: funcionario.id,
      tipo: 'demissao',
      data_evento: dados.data_desligamento,
      descricao: `Rescisão de ${funcionario.nome_completo} — motivo ${dados.motivo_desligamento}, líquido R$ ${simulacao.totalLiquidoRescisao.toFixed(2)}`,
    })
    try {
      await pb.collection('funcionarios').update(funcionario.id, {
        status: 'demitido',
        data_demissao: dados.data_desligamento,
      })
    } catch {
      // best-effort
    }
    return registro
  },

  // ---------- Afastamentos ----------
  async registrarAfastamento(
    tenantId: string,
    empresaId: string,
    funcionario: Funcionario,
    dados: { data_inicio: string; data_fim?: string; descricao: string; motivo_esocial?: string },
  ): Promise<EventoDp> {
    const evento = await pb.collection('eventos_dp').create<EventoDp>({
      tenant_id: tenantId,
      empresa: empresaId,
      funcionario: funcionario.id,
      tipo: 'afastado',
      data_evento: dados.data_inicio,
      descricao: dados.descricao,
    })
    try {
      await pb.collection('funcionarios').update(funcionario.id, { status: 'afastado' })
    } catch {
      // best-effort
    }
    return evento
  },

  async encerrarAfastamento(funcionarioId: string): Promise<void> {
    try {
      await pb.collection('funcionarios').update(funcionarioId, { status: 'ativo' })
    } catch {
      // best-effort
    }
  },

  // ---------- Obrigações (eSocial + guias) — reaproveita serviços ----------
  async listarEventosEsocial(
    tenantId: string,
    filters: { empresaId?: string; competencia?: string },
  ): Promise<EsocialEventoRecord[]> {
    return esocialService.listEventos(tenantId, {
      empresaId: filters.empresaId,
      competencia: filters.competencia,
    })
  },

  async carregarEsocialConfig(
    tenantId: string,
    empresaId: string,
  ): Promise<EsocialConfigRecord | null> {
    try {
      return await esocialService.getConfig(tenantId, empresaId)
    } catch {
      return null
    }
  },

  async listarGuias(
    tenantId: string,
    empresaId: string,
    competencia: string,
  ): Promise<GuiaPagamentoRecord[]> {
    return pb.collection('guias_pagamentos').getFullList<GuiaPagamentoRecord>({
      filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && periodo_apuracao = "${competencia}"`,
      expand: 'empresa',
    })
  },

  // ---------- Convenções coletivas ----------
  async listarConvencoes(tenantId: string, empresaId?: string): Promise<ConvencaoColetivaRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`]
    if (empresaId && empresaId !== 'todas') parts.push(`empresa = "${empresaId}"`)
    return pb.collection('convencoes_coletivas').getFullList<ConvencaoColetivaRecord>({
      filter: parts.join(' && '),
      sort: '-vigencia_fim',
    })
  },

  // ============================================================
  // Painel de alertas preventivos
  // ============================================================
  calcularAlertasPreventivos(params: {
    funcionarios: Funcionario[]
    ferias: FeriasPeriodoRecord[]
    convencoes: ConvencaoColetivaRecord[]
    hoje?: string
  }): AlertaPessoal[] {
    const { funcionarios, ferias, convencoes } = params
    const hoje = params.hoje || new Date().toISOString().slice(0, 10)
    const alertas: AlertaPessoal[] = []

    // 1. Férias vencidas (CLT art. 137 — dobra)
    for (const f of funcionarios) {
      if (f.status === 'demitido') continue
      const admissao = new Date(`${f.data_admissao}T12:00:00`)
      const diasDesdeAdmissao = diffDias(f.data_admissao, hoje)
      if (diasDesdeAdmissao < DIAS_ANO) continue
      // Ano aquisitivo encerrado sem gozo registrado
      const anosEncerrados = Math.floor(diasDesdeAdmissao / DIAS_ANO)
      const gozos = ferias.filter((fr) => fr.funcionario === f.id && fr.status !== 'cancelado')
      const periodosPagos = gozos.length
      if (anosEncerrados > periodosPagos) {
        const fimAquisitivo = somaDias(f.data_admissao, DIAS_ANO * anosEncerrados)
        const diasVencido = diffDias(fimAquisitivo, hoje)
        if (diasVencido > 0) {
          alertas.push({
            tipo: 'infracao',
            titulo: 'Férias vencidas',
            mensagem: `${f.nome_completo} tem período aquisitivo encerrado em ${fimAquisitivo} (${diasVencido} dias vencidos) sem gozo registrado. Concessão após o período constitutivo gera dobra (CLT art. 137).`,
            funcionario_id: f.id,
            funcionario_nome: f.nome_completo,
          })
        }
      }
    }

    // 2. Aviso de concessivo: 90 dias antes de férias dobrarem
    for (const f of funcionarios) {
      const diasDesdeAdmissao = diffDias(f.data_admissao, hoje)
      if (diasDesdeAdmissao < FERIAS_PROPORCIONALIDADE_DIAS * 11 + 275) continue
      const proximoFimAquisitivo = somaDias(
        f.data_admissao,
        DIAS_ANO * (Math.floor(diasDesdeAdmissao / DIAS_ANO) + 1),
      )
      const diasRestantes = diffDias(hoje, proximoFimAquisitivo)
      if (diasRestantes >= 0 && diasRestantes <= 90) {
        const temGozo = ferias.some((fr) => fr.funcionario === f.id && fr.status !== 'cancelado')
        if (!temGozo) {
          alertas.push({
            tipo: 'aviso',
            titulo: 'Conceder férias em até 90 dias',
            mensagem: `${f.nome_completo}: período concessivo encerra em ${proximoFimAquisitivo} (${diasRestantes} dias). Aprove para agendar o gozo antes que as férias dobrem (CLT art. 134).`,
            funcionario_id: f.id,
            funcionario_nome: f.nome_completo,
          })
        }
      }
    }

    // 3. Convenções coletivas a vencer
    for (const c of convencoes) {
      if (c.status_vigencia === 'vencida') {
        alertas.push({
          tipo: 'infracao',
          titulo: 'Convenção coletiva vencida',
          mensagem: `"${c.titulo}" (${c.sindicato_laboral}) venceu em ${c.vigencia_fim}. Renegocie ou registre a nova convenção para evitar aplicação de pisos desatualizados.`,
        })
      } else if (c.status_vigencia.startsWith('a_vencer')) {
        const diasRestantes = diffDias(hoje, c.vigencia_fim)
        alertas.push({
          tipo: 'aviso',
          titulo: 'Convenção coletiva a vencer',
          mensagem: `"${c.titulo}" vence em ${c.vigencia_fim} (${diasRestantes} dias). Piso atual: R$ ${toNum(c.piso_salarial).toFixed(2)} — reajuste previsto: ${toNum(c.percentual_reajuste).toFixed(1)}%.`,
        })
      }
    }

    // 4. Colaboradores afastados (suspensos da folha)
    const afastados = funcionarios.filter((f) => f.status === 'afastado')
    if (afastados.length > 0) {
      alertas.push({
        tipo: 'informativo',
        titulo: 'Colaboradores afastados',
        mensagem: `${afastados.length} colaborador(es) afastado(s) estão com folha suspensa automaticamente: ${afastados.map((f) => f.nome_completo).join(', ')}.`,
      })
    }

    return alertas
  },

  // ============================================================
  // Relatórios (recibo, 13º, aviso de férias, gerencial)
  // ============================================================
  montarReciboPagamento(params: {
    empresaNome: string
    competencia: string
    funcionario: Funcionario
    folha?: FolhaPagamento
  }): {
    titulo: string
    linhas: { descricao: string; referencia?: string; valor: number }[]
    totalProventos: number
    totalDescontos: number
    totalLiquido: number
    fgtsInformativo: number
  } {
    const { empresaNome, competencia, funcionario, folha } = params
    const proventos = parseItens(folha?.proventos)
    const descontos = parseItens(folha?.descontos)
    const linhas = [
      ...proventos.map((p) => ({
        descricao: p.descricao,
        referencia: p.referencia,
        valor: p.valor,
      })),
      ...descontos.map((d) => ({
        descricao: d.descricao,
        referencia: d.referencia,
        valor: -d.valor,
      })),
    ]
    const totalProventos = proventos.reduce((s, p) => s + p.valor, 0)
    const totalDescontos = descontos.reduce((s, d) => s + d.valor, 0)
    return {
      titulo: `Recibo de Pagamento — ${empresaNome} — Competência ${competencia}`,
      linhas,
      totalProventos: Number(totalProventos.toFixed(2)),
      totalDescontos: Number(totalDescontos.toFixed(2)),
      totalLiquido: Number(folha?.total_liquido ?? totalProventos - totalDescontos),
      fgtsInformativo: toNum(folha?.fgts),
    }
  },

  montarRelatorioGerencial(params: {
    funcionarios: Funcionario[]
    folha: FolhaPagamento[]
    incluirCbo: boolean
  }): {
    linhas: {
      nome: string
      cargo: string
      cbo?: string
      salario: number
      proventos: number
      descontos: number
      liquido: number
      inss: number
      irrf: number
      fgts: number
      status: string
    }[]
    totais: { salario: number; liquido: number; inss: number; irrf: number; fgts: number }
  } {
    const { funcionarios, folha, incluirCbo } = params
    const linhas = funcionarios
      .filter((f) => f.status !== 'demitido')
      .map((f) => {
        const fl = folha.find((x) => x.funcionario === f.id)
        return {
          nome: f.nome_completo,
          cargo: f.cargo,
          cbo: incluirCbo ? f.cbo : undefined,
          salario: toNum(f.salario),
          proventos: Number(sumItens(parseItens(fl?.proventos)).toFixed(2)),
          descontos: Number(sumItens(parseItens(fl?.descontos)).toFixed(2)),
          liquido: toNum(fl?.total_liquido),
          inss: toNum(fl?.inss),
          irrf: toNum(fl?.irrf),
          fgts: toNum(fl?.fgts),
          status: f.status,
        }
      })
    const totais = linhas.reduce(
      (acc, l) => ({
        salario: Number((acc.salario + l.salario).toFixed(2)),
        liquido: Number((acc.liquido + l.liquido).toFixed(2)),
        inss: Number((acc.inss + l.inss).toFixed(2)),
        irrf: Number((acc.irrf + l.irrf).toFixed(2)),
        fgts: Number((acc.fgts + l.fgts).toFixed(2)),
      }),
      { salario: 0, liquido: 0, inss: 0, irrf: 0, fgts: 0 },
    )
    return { linhas, totais }
  },

  competenciaAnterior,
}

// ============================================================
// Helpers de parse de json de rubricas
// ============================================================

function parseItens(value: unknown): ItemRubrica[] {
  if (!value) return []
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return []
    }
  }
  return Array.isArray(value) ? (value as ItemRubrica[]) : []
}

function sumItens(itens: ItemRubrica[]): number {
  return itens.reduce((s, i) => s + Math.abs(toNum(i.valor)), 0)
}

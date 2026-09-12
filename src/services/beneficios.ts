import pb from '@/lib/pocketbase/client'
import { auditService } from './audit'
import type {
  BeneficioConcedidoRecord,
  BeneficioTipo,
  BeneficioStatus,
  VerbaCatalogoRecord,
} from '@/types'

export interface CreateBeneficioInput {
  tenant_id: string
  empresa: string
  funcionario: string
  competencia: string
  tipo: BeneficioTipo
  dias_uteis?: number
  quantidade_dia?: number
  valor_unitario?: number
  valor_total_beneficio: number
  desconto_colaborador?: number
  custo_empresa?: number
  operadora?: string
  numero_cartao?: string
  status: BeneficioStatus
  data_entrega?: string
  observacoes?: string
}

export interface CalculoBeneficioCltParams {
  tipo: BeneficioTipo
  salarioBase: number
  diasUteis: number
  quantidadeDia: number
  valorUnitario: number
  percentualDescontoInformado?: number
}

export interface CalculoBeneficioCltResult {
  valorTotalBeneficio: number
  descontoColaborador: number
  custoEmpresa: number
  tetoLegalVt: number
  percentualEfetivoDesconto: number
  avisoLegalClt: string
}

export const beneficiosService = {
  /**
   * Cálculo legal de benefícios CLT (VT Lei 7.418/85 e VA/VR)
   * - Vale Transporte: limite de desconto de 6% do salário base ou valor total (o menor)
   * - Vale Alimentação / Refeição: coparticipação padrão negociada (normalmente até 20% pela CLT, praxe 0% a 10%)
   * - Ambos: parcela in natura isenta de INSS/IRRF/FGTS
   */
  calcularBeneficioClt(params: CalculoBeneficioCltParams): CalculoBeneficioCltResult {
    const {
      tipo,
      salarioBase,
      diasUteis,
      quantidadeDia,
      valorUnitario,
      percentualDescontoInformado,
    } = params

    const valorTotalBeneficio = Number(
      (Math.max(0, diasUteis) * Math.max(0, quantidadeDia) * Math.max(0, valorUnitario)).toFixed(2),
    )

    const tetoLegalVt = Number((salarioBase * 0.06).toFixed(2))
    let descontoColaborador = 0
    let avisoLegalClt = ''

    if (tipo === 'vale_transporte') {
      // Lei 7.418/85 Art. 4º parágrafo único: Desconto de até 6% do salário-base.
      // O empregado participa com no máximo 6% ou o valor integral do vale se menor.
      descontoColaborador = Math.min(valorTotalBeneficio, tetoLegalVt)
      avisoLegalClt =
        'Lei nº 7.418/85: O empregado custeia até 6% do seu salário-base (R$ ' +
        tetoLegalVt.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) +
        '), sendo o excedente de responsabilidade integral do empregador. Não incide INSS, FGTS nem IRRF (art. 2º).'
    } else {
      // VA / VR: coparticipação opcional informada (ex: 5% ou 0%)
      const perc =
        percentualDescontoInformado !== undefined && !isNaN(percentualDescontoInformado)
          ? percentualDescontoInformado
          : 5
      descontoColaborador = Number((valorTotalBeneficio * (perc / 100)).toFixed(2))
      avisoLegalClt =
        'PAT / Lei nº 6.321/76 e CLT art. 457 §2º: Benefício de alimentação fornecido in natura não tem natureza salarial e não constitui base de incidência de INSS, FGTS ou IRRF.'
    }

    const custoEmpresa = Number(Math.max(0, valorTotalBeneficio - descontoColaborador).toFixed(2))
    const percentualEfetivoDesconto =
      salarioBase > 0 ? Number(((descontoColaborador / salarioBase) * 100).toFixed(2)) : 0

    return {
      valorTotalBeneficio,
      descontoColaborador,
      custoEmpresa,
      tetoLegalVt,
      percentualEfetivoDesconto,
      avisoLegalClt,
    }
  },

  async listBeneficios(
    tenantId: string,
    filters?: {
      empresaId?: string
      funcionarioId?: string
      competencia?: string
      tipo?: string
    },
  ): Promise<BeneficioConcedidoRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`]

    if (filters?.empresaId && filters.empresaId !== 'todas') {
      parts.push(`empresa = "${filters.empresaId}"`)
    }
    if (filters?.funcionarioId && filters.funcionarioId !== 'todos') {
      parts.push(`funcionario = "${filters.funcionarioId}"`)
    }
    if (filters?.competencia && filters.competencia !== 'todas') {
      parts.push(`competencia = "${filters.competencia}"`)
    }
    if (filters?.tipo && filters.tipo !== 'todos') {
      parts.push(`tipo = "${filters.tipo}"`)
    }

    return pb.collection('beneficios_concedidos').getFullList<BeneficioConcedidoRecord>({
      filter: parts.join(' && '),
      sort: '-competencia,tipo',
      expand: 'empresa,funcionario',
    })
  },

  async getBeneficio(id: string): Promise<BeneficioConcedidoRecord> {
    return pb.collection('beneficios_concedidos').getOne<BeneficioConcedidoRecord>(id, {
      expand: 'empresa,funcionario',
    })
  },

  async createBeneficio(
    data: CreateBeneficioInput,
    usuarioId: string,
  ): Promise<BeneficioConcedidoRecord> {
    const rec = await pb
      .collection('beneficios_concedidos')
      .create<BeneficioConcedidoRecord>(data, {
        expand: 'empresa,funcionario',
      })

    // Sincronização automática com Lançamento de Verba (Desconto VT 9001) quando for Vale Transporte
    if (data.tipo === 'vale_transporte' && (data.desconto_colaborador || 0) > 0) {
      await this.sincronizarComVerbasLancamento(data, usuarioId)
    }

    await auditService.log(
      data.tenant_id,
      usuarioId,
      'beneficio_concedido_criado',
      'beneficios_concedidos',
      rec.id,
      `Concessão de ${data.tipo.toUpperCase()} no valor de R$ ${data.valor_total_beneficio.toFixed(2)} (Comp. ${data.competencia}).`,
    )

    return rec
  },

  async updateBeneficio(
    id: string,
    data: Partial<CreateBeneficioInput>,
    usuarioId: string,
  ): Promise<BeneficioConcedidoRecord> {
    const rec = await pb
      .collection('beneficios_concedidos')
      .update<BeneficioConcedidoRecord>(id, data, { expand: 'empresa,funcionario' })

    if (rec.tipo === 'vale_transporte' && (rec.desconto_colaborador || 0) > 0) {
      await this.sincronizarComVerbasLancamento(
        {
          tenant_id: rec.tenant_id,
          empresa: rec.empresa,
          funcionario: rec.funcionario,
          competencia: rec.competencia,
          tipo: rec.tipo,
          valor_total_beneficio: rec.valor_total_beneficio,
          desconto_colaborador: rec.desconto_colaborador,
          status: rec.status,
        },
        usuarioId,
      )
    }

    await auditService.log(
      rec.tenant_id,
      usuarioId,
      'beneficio_concedido_atualizado',
      'beneficios_concedidos',
      rec.id,
      `Atualização de benefício ${rec.tipo.toUpperCase()} (Total: R$ ${rec.valor_total_beneficio.toFixed(2)}).`,
    )

    return rec
  },

  async deleteBeneficio(id: string, usuarioId: string): Promise<boolean> {
    const rec = await pb.collection('beneficios_concedidos').getOne<BeneficioConcedidoRecord>(id)
    await pb.collection('beneficios_concedidos').delete(id)

    await auditService.log(
      rec.tenant_id,
      usuarioId,
      'beneficio_concedido_excluido',
      'beneficios_concedidos',
      id,
      `Benefício ${rec.tipo.toUpperCase()} (Comp. ${rec.competencia}) removido.`,
    )

    return true
  },

  /**
   * Sincroniza o desconto do Vale Transporte diretamente com a tabela de verbas_lancamentos
   * garantindo que a aba Verbas & Descontos e o cálculo da Folha reflitam o valor real.
   */
  async sincronizarComVerbasLancamento(
    data: {
      tenant_id: string
      empresa: string
      funcionario: string
      competencia: string
      tipo: BeneficioTipo
      desconto_colaborador?: number
      valor_total_beneficio: number
      status: BeneficioStatus
    },
    usuarioId: string,
  ) {
    if (data.tipo !== 'vale_transporte' || !data.desconto_colaborador) return

    try {
      // Localizar a verba de código 9001 ou rubrica 9904
      const verbas = await pb.collection('verbas_catalogo').getFullList<VerbaCatalogoRecord>({
        filter: `tenant_id = "${data.tenant_id}" && empresa = "${data.empresa}" && (codigo = "9001" || rubrica_esocial = "9904")`,
      })

      if (verbas.length === 0) return

      const verbaVt = verbas[0]

      // Buscar se já existe lançamento dessa verba na competência para o colaborador
      const lancamentosExistentes = await pb.collection('verbas_lancamentos').getFullList({
        filter: `tenant_id = "${data.tenant_id}" && empresa = "${data.empresa}" && funcionario = "${data.funcionario}" && verba = "${verbaVt.id}" && competencia = "${data.competencia}"`,
      })

      const refTexto = `Desconto VT Lei 7.418/85 (Custo total vales: R$ ${data.valor_total_beneficio.toFixed(2)})`

      if (lancamentosExistentes.length > 0) {
        await pb.collection('verbas_lancamentos').update(lancamentosExistentes[0].id, {
          valor_calculado: data.desconto_colaborador,
          referencia_detalhe: refTexto,
        })
      } else {
        await pb.collection('verbas_lancamentos').create({
          tenant_id: data.tenant_id,
          empresa: data.empresa,
          funcionario: data.funcionario,
          verba: verbaVt.id,
          competencia: data.competencia,
          quantidade: 1,
          aliquota_percentual: 6,
          valor_calculado: data.desconto_colaborador,
          referencia_detalhe: refTexto,
        })
      }
    } catch (err) {
      console.warn('Erro ao sincronizar benefício VT com verbas_lancamentos:', err)
    }
  },

  /**
   * Registra em auditoria a geração/impressão de recibos de entrega
   */
  async registrarAuditoriaRecibo(
    tenantId: string,
    usuarioId: string,
    tipoRecibo: 'individual' | 'consolidado_empresa',
    referencia: string,
    detalhes: string,
  ) {
    await auditService.log(
      tenantId,
      usuarioId,
      'recibo_beneficios_gerado',
      'beneficios_concedidos',
      referencia,
      `Emissão de Recibo de Benefícios (${tipoRecibo === 'individual' ? 'Individual Colaborador' : 'Consolidado Empresa'}): ${detalhes}`,
    )
  },
}

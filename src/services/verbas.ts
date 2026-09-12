import pb from '@/lib/pocketbase/client'
import { auditService } from './audit'
import type {
  VerbaCatalogoRecord,
  VerbaLancamentoRecord,
  VerbaTipo,
  VerbaUnidade,
  AlertaConformidadeClt,
} from '@/types'
import { validarLancamentoClt } from '@/lib/calculoClt'

export interface CreateVerbaCatalogoInput {
  tenant_id: string
  empresa: string
  codigo: string
  descricao: string
  tipo: VerbaTipo
  rubrica_esocial: string
  unidade: VerbaUnidade
  valor_padrao?: number
  incide_inss: boolean
  incide_irrf: boolean
  incide_fgts: boolean
  integra_salario_contrib: boolean
  reflexo_dsr: boolean
  reflexo_ferias_13: boolean
  ativo?: boolean
  observacoes?: string
}

export interface CreateVerbaLancamentoInput {
  tenant_id: string
  empresa: string
  funcionario: string
  verba: string
  competencia: string
  quantidade?: number
  aliquota_percentual?: number
  valor_calculado: number
  referencia_detalhe?: string
  alertas_clt?: AlertaConformidadeClt[]
}

export const verbasService = {
  // === CATÁLOGO DE VERBAS ===
  async listCatalogo(tenantId: string, empresaId?: string): Promise<VerbaCatalogoRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`]
    if (empresaId && empresaId !== 'todas') {
      parts.push(`empresa = "${empresaId}"`)
    }
    return pb.collection('verbas_catalogo').getFullList<VerbaCatalogoRecord>({
      filter: parts.join(' && '),
      sort: 'tipo,codigo',
      expand: 'empresa',
    })
  },

  async getVerbaCatalogo(id: string): Promise<VerbaCatalogoRecord> {
    return pb.collection('verbas_catalogo').getOne<VerbaCatalogoRecord>(id, {
      expand: 'empresa',
    })
  },

  async createVerbaCatalogo(
    data: CreateVerbaCatalogoInput,
    usuarioId: string,
  ): Promise<VerbaCatalogoRecord> {
    const rec = await pb.collection('verbas_catalogo').create<VerbaCatalogoRecord>({
      ...data,
      ativo: data.ativo !== false,
    })

    await auditService.log(
      data.tenant_id,
      usuarioId,
      'verba_catalogo_criada',
      'verbas_catalogo',
      rec.id,
      `Verba ${rec.codigo} - ${rec.descricao} (${rec.tipo.toUpperCase()}) cadastrada no catálogo da empresa.`,
    )

    return rec
  },

  async updateVerbaCatalogo(
    id: string,
    data: Partial<CreateVerbaCatalogoInput>,
    usuarioId: string,
  ): Promise<VerbaCatalogoRecord> {
    const updated = await pb.collection('verbas_catalogo').update<VerbaCatalogoRecord>(id, data)

    await auditService.log(
      updated.tenant_id,
      usuarioId,
      'verba_catalogo_atualizada',
      'verbas_catalogo',
      updated.id,
      `Verba ${updated.codigo} - ${updated.descricao} atualizada no catálogo.`,
    )

    return updated
  },

  async deleteVerbaCatalogo(id: string, usuarioId: string): Promise<boolean> {
    const rec = await pb.collection('verbas_catalogo').getOne<VerbaCatalogoRecord>(id)
    await pb.collection('verbas_catalogo').delete(id)

    await auditService.log(
      rec.tenant_id,
      usuarioId,
      'verba_catalogo_excluida',
      'verbas_catalogo',
      id,
      `Verba ${rec.codigo} - ${rec.descricao} removida do catálogo.`,
    )

    return true
  },

  // === LANÇAMENTOS POR COLABORADOR / COMPETÊNCIA ===
  async listLancamentos(
    tenantId: string,
    filters: {
      empresaId?: string
      funcionarioId?: string
      competencia?: string
    },
  ): Promise<VerbaLancamentoRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`]
    if (filters.empresaId && filters.empresaId !== 'todas') {
      parts.push(`empresa = "${filters.empresaId}"`)
    }
    if (filters.funcionarioId && filters.funcionarioId !== 'todos') {
      parts.push(`funcionario = "${filters.funcionarioId}"`)
    }
    if (filters.competencia && filters.competencia !== 'todas') {
      parts.push(`competencia = "${filters.competencia}"`)
    }

    return pb.collection('verbas_lancamentos').getFullList<VerbaLancamentoRecord>({
      filter: parts.join(' && '),
      sort: '-created',
      expand: 'empresa,funcionario,verba',
    })
  },

  async createLancamento(
    data: CreateVerbaLancamentoInput,
    usuarioId: string,
  ): Promise<VerbaLancamentoRecord> {
    const verbaObj = await pb.collection('verbas_catalogo').getOne<VerbaCatalogoRecord>(data.verba)
    const func = await pb.collection('funcionarios').getOne(data.funcionario)

    // Validação automática CLT
    const { alertas } = validarLancamentoClt({
      verba: verbaObj,
      salarioBase: func.salario || 0,
      quantidade: data.quantidade || 1,
      aliquotaPercentual: data.aliquota_percentual,
      valorCalculado: data.valor_calculado,
    })

    const payload = {
      ...data,
      alertas_clt: alertas,
    }

    const rec = await pb.collection('verbas_lancamentos').create<VerbaLancamentoRecord>(payload, {
      expand: 'empresa,funcionario,verba',
    })

    await auditService.log(
      data.tenant_id,
      usuarioId,
      'verba_lancamento_criado',
      'verbas_lancamentos',
      rec.id,
      `Lançamento de ${verbaObj.descricao} no valor de R$ ${data.valor_calculado.toFixed(2)} para ${func.nome_completo} (Comp. ${data.competencia}).`,
    )

    return rec
  },

  async updateLancamento(
    id: string,
    data: Partial<CreateVerbaLancamentoInput>,
    usuarioId: string,
  ): Promise<VerbaLancamentoRecord> {
    const current = await pb
      .collection('verbas_lancamentos')
      .getOne<VerbaLancamentoRecord>(id, { expand: 'verba,funcionario' })
    const verbaObj =
      (current.expand?.verba as VerbaCatalogoRecord) ||
      (await pb
        .collection('verbas_catalogo')
        .getOne<VerbaCatalogoRecord>(data.verba || current.verba))
    const func =
      current.expand?.funcionario ||
      (await pb.collection('funcionarios').getOne(current.funcionario))

    const qtd = data.quantidade !== undefined ? data.quantidade : current.quantidade || 1
    const val = data.valor_calculado !== undefined ? data.valor_calculado : current.valor_calculado
    const aliq =
      data.aliquota_percentual !== undefined
        ? data.aliquota_percentual
        : current.aliquota_percentual

    const { alertas } = validarLancamentoClt({
      verba: verbaObj,
      salarioBase: func.salario || 0,
      quantidade: qtd,
      aliquotaPercentual: aliq,
      valorCalculado: val,
    })

    const updated = await pb.collection('verbas_lancamentos').update<VerbaLancamentoRecord>(
      id,
      {
        ...data,
        alertas_clt: alertas,
      },
      { expand: 'empresa,funcionario,verba' },
    )

    await auditService.log(
      updated.tenant_id,
      usuarioId,
      'verba_lancamento_atualizado',
      'verbas_lancamentos',
      updated.id,
      `Lançamento da verba ${verbaObj.descricao} atualizado para R$ ${val.toFixed(2)}.`,
    )

    return updated
  },

  async deleteLancamento(id: string, usuarioId: string): Promise<boolean> {
    const rec = await pb
      .collection('verbas_lancamentos')
      .getOne<VerbaLancamentoRecord>(id, { expand: 'funcionario,verba' })
    await pb.collection('verbas_lancamentos').delete(id)

    const funcNome = rec.expand?.funcionario?.nome_completo || 'Colaborador'
    const verbaNome = (rec.expand?.verba as VerbaCatalogoRecord)?.descricao || 'Verba'

    await auditService.log(
      rec.tenant_id,
      usuarioId,
      'verba_lancamento_excluido',
      'verbas_lancamentos',
      id,
      `Lançamento de ${verbaNome} de ${funcNome} (Comp. ${rec.competencia}) removido.`,
    )

    return true
  },
}

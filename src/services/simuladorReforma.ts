import pb from '@/lib/pocketbase/client'
import type { SimulacaoReformaRecord } from '@/types'
import type { SimulacaoCalculada } from '@/lib/reformaTributaria/calculos'

export interface SalvarSimulacaoInput {
  tenantId: string
  empresaId?: string
  titulo: string
  razaoSocial?: string
  cnpj?: string
  regimeAtual: 'simples_nacional' | 'lucro_presumido' | 'lucro_real'
  setorAtividade: string
  faturamentoAnual: number
  aliquotaAtualEstimada: number
  percentualCreditos?: number
  reducaoSetorial60?: boolean
  vendeCestaBasica?: boolean
  calculada: SimulacaoCalculada
  compartilhadoPortal?: boolean
  criadoPor?: string
}

export const simuladorReformaService = {
  async list(tenantId: string, empresaId?: string): Promise<SimulacaoReformaRecord[]> {
    let filter = `tenant_id = "${tenantId}"`
    if (empresaId) {
      filter += ` && empresa = "${empresaId}"`
    }
    const records = await pb.collection('simulacoes_reforma').getFullList<SimulacaoReformaRecord>({
      filter,
      sort: '-created',
      expand: 'empresa,criado_por',
    })
    return records
  },

  async getById(id: string): Promise<SimulacaoReformaRecord> {
    return await pb.collection('simulacoes_reforma').getOne<SimulacaoReformaRecord>(id, {
      expand: 'empresa,criado_por',
    })
  },

  async create(data: SalvarSimulacaoInput): Promise<SimulacaoReformaRecord> {
    const payload = {
      tenant_id: data.tenantId,
      empresa: data.empresaId || null,
      titulo: data.titulo,
      razao_social: data.razaoSocial || '',
      cnpj: data.cnpj || '',
      regime_atual: data.regimeAtual,
      setor_atividade: data.setorAtividade,
      faturamento_anual: data.faturamentoAnual,
      aliquota_atual_estimada: data.aliquotaAtualEstimada,
      percentual_creditos: data.percentualCreditos || 0,
      reducao_setorial_60: !!data.reducaoSetorial60,
      vende_cesta_basica: !!data.vendeCestaBasica,
      inputs_json: data.calculada.inputs,
      resultado_json: {
        resumo: data.calculada.resumo,
        tabelaAnual: data.calculada.tabelaAnual,
        parametrosUtilizados: data.calculada.parametrosUtilizados,
      },
      compartilhado_portal: !!data.compartilhadoPortal,
      criado_por: data.criadoPor || null,
    }

    const created = await pb
      .collection('simulacoes_reforma')
      .create<SimulacaoReformaRecord>(payload)

    // Trilha de auditoria
    try {
      await pb.collection('audit_log').create({
        tenant_id: data.tenantId,
        usuario_id: data.criadoPor || null,
        acao: 'CRIAR_SIMULACAO_REFORMA',
        entidade_tipo: 'simulacoes_reforma',
        entidade_id: created.id,
        detalhes: `Simulação da Reforma criada: "${data.titulo}" para ${data.razaoSocial || 'Análise Avulsa'}`,
      })
    } catch (err) {
      console.warn('Falha ao registrar auditoria de simulação:', err)
    }

    return created
  },

  async togglePortalShare(
    id: string,
    compartilhado: boolean,
    tenantId: string,
    userId?: string,
  ): Promise<SimulacaoReformaRecord> {
    const updated = await pb.collection('simulacoes_reforma').update<SimulacaoReformaRecord>(id, {
      compartilhado_portal: compartilhado,
    })

    try {
      await pb.collection('audit_log').create({
        tenant_id: tenantId,
        usuario_id: userId || null,
        acao: 'COMPARTILHAR_SIMULACAO_PORTAL',
        entidade_tipo: 'simulacoes_reforma',
        entidade_id: id,
        detalhes: `Status de compartilhamento no portal alterado para: ${compartilhado ? 'Sim' : 'Não'}`,
      })
    } catch {
      /* intentionally ignored */
    }

    return updated
  },

  async delete(id: string, tenantId: string, userId?: string): Promise<boolean> {
    await pb.collection('simulacoes_reforma').delete(id)
    try {
      await pb.collection('audit_log').create({
        tenant_id: tenantId,
        usuario_id: userId || null,
        acao: 'EXCLUIR_SIMULACAO_REFORMA',
        entidade_tipo: 'simulacoes_reforma',
        entidade_id: id,
        detalhes: `Simulação de reforma ID ${id} excluída.`,
      })
    } catch {
      /* intentionally ignored */
    }
    return true
  },
}

import pb from '@/lib/pocketbase/client'
import { PARAMETROS_REFORMA } from '@/lib/reformaTributaria/parametros'
import type { ParametrosReformaRecord, ParametrosReformaConfig } from '@/types'

export const parametrosReformaService = {
  // Obter parâmetro ativo do tenant ou retornar null se usar o padrão do código
  async getAtivo(tenantId: string): Promise<ParametrosReformaRecord | null> {
    try {
      const records = await pb
        .collection('parametros_reforma')
        .getFullList<ParametrosReformaRecord>({
          filter: `tenant_id = "${tenantId}" && ativo = true`,
          sort: '-created',
          expand: 'atualizado_por',
        })

      return records.length > 0 ? records[0] : null
    } catch (err) {
      console.warn('Erro ao buscar parâmetros ativos da reforma:', err)
      return null
    }
  },

  // Listar histórico de versões parametrizadas
  async listHistorico(tenantId: string): Promise<ParametrosReformaRecord[]> {
    return pb.collection('parametros_reforma').getFullList<ParametrosReformaRecord>({
      filter: `tenant_id = "${tenantId}"`,
      sort: '-created',
      expand: 'atualizado_por',
    })
  },

  // Salvar nova versão customizada e ativar
  async salvarNovaVersao(
    tenantId: string,
    input: {
      fonte: string
      descricaoAlteracao?: string
      parametros: ParametrosReformaConfig
      userId?: string
    },
  ): Promise<ParametrosReformaRecord> {
    // 1. Obter versões existentes para calcular o próximo número de versão
    const historico = await this.listHistorico(tenantId)
    const proximaVersao = historico.reduce((max, h) => Math.max(max, h.versao || 0), 0) + 1

    // 2. Desativar versões ativas anteriores
    for (const h of historico) {
      if (h.ativo) {
        try {
          await pb.collection('parametros_reforma').update(h.id, { ativo: false })
        } catch {
          /* intentionally ignored */
        }
      }
    }

    // 3. Criar nova versão como ativa
    const record = await pb.collection('parametros_reforma').create<ParametrosReformaRecord>(
      {
        tenant_id: tenantId,
        ativo: true,
        versao: proximaVersao,
        fonte: input.fonte.trim(),
        descricao_alteracao:
          input.descricaoAlteracao?.trim() || `Atualização de parâmetros v${proximaVersao}`,
        parametros_json: input.parametros,
        atualizado_por: input.userId || null,
      },
      { expand: 'atualizado_por' },
    )

    // 4. Auditoria
    try {
      await pb.collection('audit_log').create({
        tenant_id: tenantId,
        usuario_id: input.userId || null,
        acao: 'SALVAR_PARAMETROS_REFORMA',
        entidade_tipo: 'parametros_reforma',
        entidade_id: record.id,
        detalhes: `Parâmetros da Reforma Tributária atualizados para v${proximaVersao}. Fonte: ${input.fonte}. CBS: ${input.parametros.aliquotaReferenciaPlena.cbs}%, IBS: ${input.parametros.aliquotaReferenciaPlena.ibs}%.`,
      })
    } catch {
      /* intentionally ignored */
    }

    return record
  },

  // Reativar versão anterior do histórico
  async reverterParaVersao(
    tenantId: string,
    versaoId: string,
    userId?: string,
  ): Promise<ParametrosReformaRecord> {
    const historico = await this.listHistorico(tenantId)
    for (const h of historico) {
      if (h.id !== versaoId && h.ativo) {
        await pb.collection('parametros_reforma').update(h.id, { ativo: false })
      }
    }

    const updated = await pb
      .collection('parametros_reforma')
      .update<ParametrosReformaRecord>(versaoId, { ativo: true }, { expand: 'atualizado_por' })

    try {
      await pb.collection('audit_log').create({
        tenant_id: tenantId,
        usuario_id: userId || null,
        acao: 'REVERTER_PARAMETROS_REFORMA',
        entidade_tipo: 'parametros_reforma',
        entidade_id: versaoId,
        detalhes: `Parâmetros da Reforma revertidos para versão v${updated.versao} (${updated.fonte})`,
      })
    } catch {
      /* intentionally ignored */
    }

    return updated
  },

  // Desativar parâmetros customizados e voltar ao padrão nativo do código
  async restaurarPadraoCodigo(tenantId: string, userId?: string): Promise<boolean> {
    const historico = await this.listHistorico(tenantId)
    for (const h of historico) {
      if (h.ativo) {
        await pb.collection('parametros_reforma').update(h.id, { ativo: false })
      }
    }

    try {
      await pb.collection('audit_log').create({
        tenant_id: tenantId,
        usuario_id: userId || null,
        acao: 'RESTAURAR_PARAMETROS_PADRAO_REFORMA',
        entidade_tipo: 'parametros_reforma',
        entidade_id: tenantId,
        detalhes: 'Restaurados parâmetros padrão do código legal (LC 214/2025 e EC 132/2023).',
      })
    } catch {
      /* intentionally ignored */
    }

    return true
  },

  // Obter o template padrão com base no código nativo
  getPadraoCodigo(): ParametrosReformaConfig {
    return {
      versaoNormativa: PARAMETROS_REFORMA.versaoNormativa,
      fonte: PARAMETROS_REFORMA.fonte,
      aliquotaReferenciaPlena: { ...PARAMETROS_REFORMA.aliquotaReferenciaPlena },
      reducoes: { ...PARAMETROS_REFORMA.reducoes },
      simplesNacional: { ...PARAMETROS_REFORMA.simplesNacional },
      calendarioTransicao: PARAMETROS_REFORMA.calendarioTransicao.map((c) => ({ ...c })),
    }
  },
}

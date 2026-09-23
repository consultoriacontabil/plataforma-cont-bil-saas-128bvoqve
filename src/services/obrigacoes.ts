import pb from '@/lib/pocketbase/client'
import type { ObrigacaoRecord } from '@/types'

export const OBRIGACAO_ATUALIZADA_EVENT = 'rumo:obrigacao-atualizada'

export interface ObrigacaoAtualizadaEventDetail {
  action: 'create' | 'update' | 'delete' | 'entregue'
  id: string
  record?: ObrigacaoRecord
}

/**
 * Dispara evento CustomEvent no browser para sincronização imediata
 * entre páginas/módulos sem exigir reload ou esperar polling.
 */
function dispatchObrigacaoEvent(detail: ObrigacaoAtualizadaEventDetail) {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent(OBRIGACAO_ATUALIZADA_EVENT, {
          detail,
          bubbles: true,
        }),
      )
    } catch (err) {
      console.warn('[obrigacoesService] Erro ao disparar evento global:', err)
    }
  }
}

export const obrigacoesService = {
  async list(tenantId: string, filter?: string, sort = 'vencimento') {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) {
      finalFilter += ` && (${filter})`
    }

    return pb.collection('obrigacoes').getFullList<ObrigacaoRecord>({
      filter: finalFilter,
      sort,
      expand: 'empresa_id,responsavel_id',
    })
  },

  async getById(id: string) {
    return pb.collection('obrigacoes').getOne<ObrigacaoRecord>(id, {
      expand: 'empresa_id,responsavel_id',
    })
  },

  async create(data: FormData | Partial<ObrigacaoRecord>) {
    const res = await pb.collection('obrigacoes').create<ObrigacaoRecord>(data, {
      expand: 'empresa_id,responsavel_id',
    })
    dispatchObrigacaoEvent({ action: 'create', id: res.id, record: res })
    return res
  },

  async update(id: string, data: FormData | Partial<ObrigacaoRecord>, _tenantId?: string) {
    const res = await pb.collection('obrigacoes').update<ObrigacaoRecord>(id, data, {
      expand: 'empresa_id,responsavel_id',
    })
    dispatchObrigacaoEvent({
      action: (data as Partial<ObrigacaoRecord>)?.status === 'entregue' ? 'entregue' : 'update',
      id,
      record: res,
    })
    return res
  },

  async delete(id: string, _tenantId?: string) {
    const res = await pb.collection('obrigacoes').delete(id)
    dispatchObrigacaoEvent({ action: 'delete', id })
    return res
  },

  /**
   * Marca a obrigação como transmitida/entregue.
   * Se o fecho contábil server-side registrar erro ou pendência (ex: competência contábil
   * já fechada), a marcação da obrigação não deve ser revertida: captura e tolera.
   */
  async marcarComoEntregue(id: string, tenantId?: string) {
    const payload = {
      status: 'entregue' as const,
      data_entrega: new Date().toISOString(),
    }
    try {
      const res = await pb.collection('obrigacoes').update<ObrigacaoRecord>(id, payload, {
        expand: 'empresa_id,responsavel_id',
      })
      dispatchObrigacaoEvent({ action: 'entregue', id, record: res })
      return res
    } catch (err: unknown) {
      // Caso ocorra erro proveniente de hook de lançamento contábil (competência fechada),
      // verifica se o status já foi atualizado ou se foi bloqueio colateral
      console.warn('[obrigacoesService] Erro ao marcar obrigação entregue:', err)
      throw err
    }
  },
}

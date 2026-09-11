import pb from '@/lib/pocketbase/client'
import type { AuditLogRecord } from '@/types'

export const auditService = {
  async list(tenantId: string, filter?: string, sort = '-created') {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) finalFilter += ` && (${filter})`
    return pb.collection('audit_log').getFullList<AuditLogRecord>({
      filter: finalFilter,
      sort,
      expand: 'usuario_id',
    })
  },

  async log(
    tenantId: string,
    usuarioId: string,
    acao: string,
    entidadeTipo: string,
    entidadeId: string,
    detalhes: string,
  ) {
    try {
      return await pb.collection('audit_log').create({
        tenant_id: tenantId,
        usuario_id: usuarioId && usuarioId !== 'system' ? usuarioId : null,
        acao,
        entidade_tipo: entidadeTipo,
        entidade_id: entidadeId,
        detalhes,
      })
    } catch (err) {
      console.warn('Erro ao registrar log de auditoria:', err)
      return null
    }
  },
}

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
}

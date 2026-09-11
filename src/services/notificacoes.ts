import pb from '@/lib/pocketbase/client'
import type { NotificacaoRecord } from '@/types'

export const notificacoesService = {
  async list(tenantId: string, userId?: string) {
    let filter = `tenant_id = "${tenantId}"`
    if (userId) {
      filter += ` && (usuario_destino_id = "${userId}" || usuario_destino_id = "")`
    }
    return pb.collection('notificacoes').getFullList<NotificacaoRecord>({
      filter,
      sort: '-created',
      limit: 50,
    })
  },

  async countUnread(tenantId: string, userId?: string) {
    let filter = `tenant_id = "${tenantId}" && lida = false`
    if (userId) {
      filter += ` && (usuario_destino_id = "${userId}" || usuario_destino_id = "")`
    }
    const res = await pb.collection('notificacoes').getList(1, 1, {
      filter,
    })
    return res.totalItems
  },

  async markAsRead(id: string) {
    return pb.collection('notificacoes').update<NotificacaoRecord>(id, { lida: true })
  },

  async markAllAsRead(tenantId: string, userId?: string) {
    let filter = `tenant_id = "${tenantId}" && lida = false`
    if (userId) {
      filter += ` && (usuario_destino_id = "${userId}" || usuario_destino_id = "")`
    }
    const unread = await pb.collection('notificacoes').getFullList<NotificacaoRecord>({
      filter,
    })
    return Promise.all(
      unread.map((n) => pb.collection('notificacoes').update(n.id, { lida: true })),
    )
  },

  async delete(id: string) {
    return pb.collection('notificacoes').delete(id)
  },
}

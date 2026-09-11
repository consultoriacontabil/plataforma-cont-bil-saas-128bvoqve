import pb from '@/lib/pocketbase/client'
import type { Tenant, TenantMember, User } from '@/types'

export const usersService = {
  async listMembers(tenantId: string) {
    return pb.collection('tenant_members').getFullList<TenantMember>({
      filter: `tenant_id = "${tenantId}"`,
      sort: '-created',
      expand: 'user_id,tenant_id',
    })
  },

  async updateMemberRole(memberId: string, perfil: TenantMember['perfil']) {
    return pb.collection('tenant_members').update<TenantMember>(memberId, { perfil })
  },

  async removeMember(memberId: string) {
    return pb.collection('tenant_members').delete(memberId)
  },

  async inviteUser(tenantId: string, name: string, email: string, perfil: string) {
    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        name,
        email,
        perfil,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Falha ao convidar usuário')
    }
    return data
  },

  async updateProfile(userId: string, data: FormData | Partial<User>) {
    return pb.collection('users').update<User>(userId, data)
  },

  async getUserTenants(userId: string) {
    const members = await pb.collection('tenant_members').getFullList<TenantMember>({
      filter: `user_id = "${userId}" && status = "ativo"`,
      expand: 'tenant_id',
    })
    return members.map((m) => m.expand?.tenant_id).filter((t): t is Tenant => Boolean(t))
  },
}

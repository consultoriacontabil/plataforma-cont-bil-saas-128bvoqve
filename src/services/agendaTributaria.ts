import pb from '@/lib/pocketbase/client'
import type { AgendaTributaria, EmpresaRegime } from '@/types'

export const agendaTributariaService = {
  async list(tenantId: string, filter?: string, sort = 'perfil,codigo') {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) finalFilter += ` && (${filter})`
    return pb.collection('agenda_tributaria').getFullList<AgendaTributaria>({
      filter: finalFilter,
      sort,
    })
  },

  async listByPerfis(tenantId: string, perfis: EmpresaRegime[]) {
    if (perfis.length === 0) return []
    const filtroPerfil = perfis.map((p) => `perfil = "${p}"`).join(' || ')
    return this.list(tenantId, `(${filtroPerfil} || perfil = "todas")`)
  },

  async create(data: Partial<AgendaTributaria>) {
    return pb.collection('agenda_tributaria').create<AgendaTributaria>(data)
  },

  async update(id: string, data: Partial<AgendaTributaria>) {
    return pb.collection('agenda_tributaria').update<AgendaTributaria>(id, data)
  },

  async delete(id: string) {
    return pb.collection('agenda_tributaria').delete(id)
  },
}

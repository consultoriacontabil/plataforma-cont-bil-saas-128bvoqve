import pb from '@/lib/pocketbase/client'
import type { PortalAcesso, Documento, ObrigacaoRecord, Empresa } from '@/types'

export const portalService = {
  // === Lado Escritório: Gestão de Acessos ao Portal ===
  async listAcessos(tenantId: string, filter?: string) {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) finalFilter += ` && (${filter})`
    return pb.collection('portal_acessos').getFullList<PortalAcesso>({
      filter: finalFilter,
      sort: '-created',
      expand: 'empresa,user',
    })
  },

  async convidarContato(data: {
    tenant_id: string
    empresa: string
    email: string
    nome_contato: string
  }) {
    // 1. Criar ou buscar usuário cliente
    let userRecord
    try {
      userRecord = await pb.collection('users').getFirstListItem(`email = "${data.email}"`)
    } catch (_) {
      // Criar usuário com senha padrão Skip@Pass
      userRecord = await pb.collection('users').create({
        email: data.email,
        password: 'Skip@Pass',
        passwordConfirm: 'Skip@Pass',
        name: data.nome_contato,
      })
    }

    // 2. Vincular como tenant_member com perfil 'cliente'
    try {
      const existingMembers = await pb.collection('tenant_members').getFullList({
        filter: `tenant_id = "${data.tenant_id}" && user_id = "${userRecord.id}"`,
      })
      if (existingMembers.length === 0) {
        await pb.collection('tenant_members').create({
          tenant_id: data.tenant_id,
          user_id: userRecord.id,
          perfil: 'cliente',
          status: 'ativo',
        })
      }
    } catch (err) {
      console.warn('Erro ao associar tenant member:', err)
    }

    // 3. Criar registro portal_acessos
    return pb.collection('portal_acessos').create<PortalAcesso>({
      tenant_id: data.tenant_id,
      empresa: data.empresa,
      email: data.email,
      nome_contato: data.nome_contato,
      user: userRecord.id,
      ativo: true,
    })
  },

  async toggleAcesso(id: string, ativo: boolean) {
    return pb.collection('portal_acessos').update<PortalAcesso>(id, { ativo })
  },

  async deleteAcesso(id: string) {
    return pb.collection('portal_acessos').delete(id)
  },

  // === Lado Cliente: Dados da Empresa do Usuário Logado ===
  async getClienteEmpresas(tenantId: string, userEmail: string): Promise<Empresa[]> {
    const acessos = await pb.collection('portal_acessos').getFullList<PortalAcesso>({
      filter: `tenant_id = "${tenantId}" && email = "${userEmail}" && ativo = true`,
      expand: 'empresa',
    })
    return acessos.map((a) => a.expand?.empresa).filter((e): e is Empresa => Boolean(e))
  },

  async getClienteDocumentos(tenantId: string, empresaId: string) {
    return pb.collection('documentos').getFullList<Documento>({
      filter: `tenant_id = "${tenantId}" && empresa_id = "${empresaId}"`,
      sort: '-created',
    })
  },

  async uploadClienteDocumento(formData: FormData) {
    return pb.collection('documentos').create<Documento>(formData)
  },

  async getClienteObrigacoes(tenantId: string, empresaId: string) {
    return pb.collection('obrigacoes').getFullList<ObrigacaoRecord>({
      filter: `tenant_id = "${tenantId}" && empresa_id = "${empresaId}"`,
      sort: 'vencimento',
    })
  },
}

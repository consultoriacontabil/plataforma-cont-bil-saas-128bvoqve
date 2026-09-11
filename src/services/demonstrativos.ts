import pb from '@/lib/pocketbase/client'
import type { DemonstrativoRecord, DemonstrativoTipo, DemonstrativoStatus } from '@/types'
import type { DREResultado, BalancoResultado } from '@/services/relatoriosContabeis'

export interface GerarDemonstrativoInput {
  tenantId: string
  empresaId: string
  competencia: string
  tipo: DemonstrativoTipo
  dados: Record<string, unknown> | DREResultado | BalancoResultado
  geradoPorId?: string
}

export const demonstrativosService = {
  // Listar demonstrativos com filtros
  async list(
    tenantId: string,
    filters?: {
      empresaId?: string
      competencia?: string
      tipo?: DemonstrativoTipo | 'todos'
      status?: DemonstrativoStatus | 'todos'
    },
  ): Promise<DemonstrativoRecord[]> {
    const filterParts: string[] = [`tenant_id = "${tenantId}"`]

    if (filters?.empresaId && filters.empresaId !== 'todas') {
      filterParts.push(`empresa = "${filters.empresaId}"`)
    }
    if (filters?.competencia && filters.competencia !== 'todas') {
      filterParts.push(`competencia = "${filters.competencia}"`)
    }
    if (filters?.tipo && filters.tipo !== 'todos') {
      filterParts.push(`tipo = "${filters.tipo}"`)
    }
    if (filters?.status && filters.status !== 'todos') {
      filterParts.push(`status = "${filters.status}"`)
    }

    return pb.collection('demonstrativos').getFullList<DemonstrativoRecord>({
      filter: filterParts.join(' && '),
      sort: '-created',
      expand: 'empresa,aprovado_por,gerado_por',
    })
  },

  async getById(id: string): Promise<DemonstrativoRecord> {
    return pb.collection('demonstrativos').getOne<DemonstrativoRecord>(id, {
      expand: 'empresa,aprovado_por,gerado_por',
    })
  },

  // Gerar e congelar demonstrativo para assinatura
  async gerarDemonstrativo(input: GerarDemonstrativoInput): Promise<DemonstrativoRecord> {
    // Verificar se já existe um demonstrativo para empresa + comp + tipo
    const existing = await pb.collection('demonstrativos').getFullList<DemonstrativoRecord>({
      filter: `tenant_id = "${input.tenantId}" && empresa = "${input.empresaId}" && competencia = "${input.competencia}" && tipo = "${input.tipo}"`,
    })

    if (existing.length > 0) {
      // Atualiza os dados mantendo o id
      return pb.collection('demonstrativos').update<DemonstrativoRecord>(
        existing[0].id,
        {
          dados: input.dados,
          status: 'rascunho',
          gerado_por: input.geradoPorId || undefined,
          data_envio: null,
          data_aprovacao: null,
          observacoes_cliente: '',
          aprovado_por: null,
        },
        { expand: 'empresa,aprovado_por,gerado_por' },
      )
    }

    return pb.collection('demonstrativos').create<DemonstrativoRecord>(
      {
        tenant_id: input.tenantId,
        empresa: input.empresaId,
        competencia: input.competencia,
        tipo: input.tipo,
        dados: input.dados,
        status: 'rascunho',
        gerado_por: input.geradoPorId || undefined,
      },
      { expand: 'empresa,aprovado_por,gerado_por' },
    )
  },

  // Enviar ao cliente
  async enviarAoCliente(id: string): Promise<DemonstrativoRecord> {
    return pb.collection('demonstrativos').update<DemonstrativoRecord>(
      id,
      {
        status: 'enviado',
        data_envio: new Date().toISOString(),
      },
      { expand: 'empresa,aprovado_por,gerado_por' },
    )
  },

  // Aprovar pelo cliente no portal
  async aprovarPeloCliente(id: string, clienteUserId: string): Promise<DemonstrativoRecord> {
    return pb.collection('demonstrativos').update<DemonstrativoRecord>(
      id,
      {
        status: 'aprovado',
        data_aprovacao: new Date().toISOString(),
        aprovado_por: clienteUserId,
      },
      { expand: 'empresa,aprovado_por,gerado_por' },
    )
  },

  // Reprovar pelo cliente no portal com observação obrigatória
  async reprovarPeloCliente(
    id: string,
    observacao: string,
    clienteUserId: string,
  ): Promise<DemonstrativoRecord> {
    if (!observacao || !observacao.trim()) {
      throw new Error('A observação é obrigatória ao reprovar um demonstrativo.')
    }
    return pb.collection('demonstrativos').update<DemonstrativoRecord>(
      id,
      {
        status: 'reprovado',
        observacoes_cliente: observacao.trim(),
        aprovado_por: clienteUserId,
      },
      { expand: 'empresa,aprovado_por,gerado_por' },
    )
  },

  // Excluir demonstrativo rascunho
  async delete(id: string): Promise<boolean> {
    return pb.collection('demonstrativos').delete(id)
  },
}

import pb from '@/lib/pocketbase/client'
import type { TarefaEquipe, TarefaEquipeStatus } from '@/types'

export const tarefasEquipeService = {
  async list(tenantId: string, filter?: string, sort = '-created') {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) finalFilter += ` && (${filter})`
    return pb.collection('tarefas_equipe').getFullList<TarefaEquipe>({
      filter: finalFilter,
      sort,
      expand: 'responsavel_id,empresa_id',
    })
  },

  async create(data: {
    tenant_id: string
    titulo: string
    descricao?: string
    responsavel_id?: string
    empresa_id?: string
    vencimento?: string
    status: TarefaEquipeStatus
    prioridade?: string
  }) {
    return pb.collection('tarefas_equipe').create<TarefaEquipe>(data, {
      expand: 'responsavel_id,empresa_id',
    })
  },

  async update(
    id: string,
    data: {
      titulo?: string
      descricao?: string
      responsavel_id?: string
      empresa_id?: string
      vencimento?: string
      status?: TarefaEquipeStatus
      prioridade?: string
    },
  ) {
    return pb.collection('tarefas_equipe').update<TarefaEquipe>(id, data, {
      expand: 'responsavel_id,empresa_id',
    })
  },

  async marcarConcluida(id: string) {
    return pb.collection('tarefas_equipe').update<TarefaEquipe>(
      id,
      { status: 'concluida' },
      {
        expand: 'responsavel_id,empresa_id',
      },
    )
  },

  async delete(id: string) {
    return pb.collection('tarefas_equipe').delete(id)
  },
}

import pb from '@/lib/pocketbase/client'
import type { Workflow, WorkflowActivity } from '@/types'

export const workflowService = {
  async list(tenantId: string, filter?: string, sort = '-prazo') {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) finalFilter += ` && (${filter})`
    return pb.collection('workflows').getFullList<Workflow>({
      filter: finalFilter,
      sort,
      expand: 'empresa_id,atribuido_id,criado_por_id',
    })
  },

  async getById(id: string) {
    return pb.collection('workflows').getOne<Workflow>(id, {
      expand: 'empresa_id,atribuido_id,criado_por_id',
    })
  },

  async create(data: Partial<Workflow>) {
    return pb.collection('workflows').create<Workflow>(data)
  },

  async update(id: string, data: Partial<Workflow>) {
    return pb.collection('workflows').update<Workflow>(id, data)
  },

  async delete(id: string) {
    return pb.collection('workflows').delete(id)
  },

  async listActivities(workflowId: string) {
    return pb.collection('workflow_activity').getFullList<WorkflowActivity>({
      filter: `workflow_id = "${workflowId}"`,
      sort: '-created',
      expand: 'usuario_id',
    })
  },

  async addActivity(data: Partial<WorkflowActivity>) {
    return pb.collection('workflow_activity').create<WorkflowActivity>(data)
  },
}

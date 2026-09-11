import pb from '@/lib/pocketbase/client'
import type { Empresa, Documento, Workflow, ObrigacaoRecord, TenantMember } from '@/types'

export interface FechamentoEmpresaRow {
  empresaId: string
  empresaNome: string
  cnpj: string
  regime: string
  documentosRecebidos: number
  documentosPendentes: number
  workflowsConcluidos: number
  workflowsPendentes: number
  obrigacoesEntregues: number
  obrigacoesAtrasadas: number
  obrigacoesPendentes: number
  totalObrigacoesValor: number
}

export interface ProdutividadeUsuarioRow {
  userId: string
  userName: string
  email: string
  perfil: string
  workflowsTratados: number
  workflowsConcluidos: number
  obrigacoesEntregues: number
  obrigacoesAtrasadas: number
  tempoMedioConclusaoHoras: number
}

export interface RelatoriosFiltro {
  periodo: 'mes_atual' | '3_meses' | '6_meses' | '12_meses' | 'custom'
  dataInicio?: string
  dataFim?: string
  empresaId?: string
}

export const relatoriosService = {
  getPeriodoDates(filtro: RelatoriosFiltro): { inicio: Date; fim: Date } {
    const now = new Date()
    let inicio = new Date(now.getFullYear(), now.getMonth(), 1)
    let fim = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    if (filtro.periodo === '3_meses') {
      inicio = new Date(now.getTime() - 90 * 86400000)
      fim = now
    } else if (filtro.periodo === '6_meses') {
      inicio = new Date(now.getTime() - 180 * 86400000)
      fim = now
    } else if (filtro.periodo === '12_meses') {
      inicio = new Date(now.getTime() - 365 * 86400000)
      fim = now
    } else if (filtro.periodo === 'custom' && filtro.dataInicio && filtro.dataFim) {
      inicio = new Date(filtro.dataInicio)
      fim = new Date(`${filtro.dataFim}T23:59:59`)
    }

    return { inicio, fim }
  },

  async getFechamentoPorEmpresa(
    tenantId: string,
    filtro: RelatoriosFiltro,
  ): Promise<FechamentoEmpresaRow[]> {
    const { inicio, fim } = this.getPeriodoDates(filtro)
    const inicioISO = inicio.toISOString()
    const fimISO = fim.toISOString()

    const [empresas, docs, wfs, obs] = await Promise.all([
      pb.collection('empresas').getFullList<Empresa>({
        filter:
          filtro.empresaId && filtro.empresaId !== 'todas'
            ? `tenant_id = "${tenantId}" && id = "${filtro.empresaId}"`
            : `tenant_id = "${tenantId}"`,
      }),
      pb.collection('documentos').getFullList<Documento>({
        filter: `tenant_id = "${tenantId}" && created >= "${inicioISO}" && created <= "${fimISO}"`,
      }),
      pb.collection('workflows').getFullList<Workflow>({
        filter: `tenant_id = "${tenantId}" && created >= "${inicioISO}" && created <= "${fimISO}"`,
      }),
      pb.collection('obrigacoes').getFullList<ObrigacaoRecord>({
        filter: `tenant_id = "${tenantId}" && vencimento >= "${inicioISO}" && vencimento <= "${fimISO}"`,
      }),
    ])

    return empresas.map((emp) => {
      const empDocs = docs.filter((d) => d.empresa_id === emp.id)
      const empWfs = wfs.filter((w) => w.empresa_id === emp.id)
      const empObs = obs.filter((o) => o.empresa_id === emp.id)

      const docPend = empDocs.filter((d) => d.status === 'pendente').length
      const wfConcl = empWfs.filter((w) => w.status === 'concluido').length
      const wfPend = empWfs.filter(
        (w) => w.status === 'pendente' || w.status === 'em_andamento',
      ).length
      const obEntr = empObs.filter((o) => o.status === 'entregue').length
      const obAtr = empObs.filter((o) => o.status === 'atrasada').length
      const obPend = empObs.filter(
        (o) => o.status === 'pendente' || o.status === 'em_andamento',
      ).length
      const totalValor = empObs.reduce((acc, o) => acc + (o.valor || 0), 0)

      return {
        empresaId: emp.id,
        empresaNome: emp.nome_fantasia || emp.razao_social,
        cnpj: emp.cnpj,
        regime: emp.regime_tributario || 'Não especificado',
        documentosRecebidos: empDocs.length,
        documentosPendentes: docPend,
        workflowsConcluidos: wfConcl,
        workflowsPendentes: wfPend,
        obrigacoesEntregues: obEntr,
        obrigacoesAtrasadas: obAtr,
        obrigacoesPendentes: obPend,
        totalObrigacoesValor: totalValor,
      }
    })
  },

  async getProdutividadePorUsuario(
    tenantId: string,
    filtro: RelatoriosFiltro,
  ): Promise<ProdutividadeUsuarioRow[]> {
    const { inicio, fim } = this.getPeriodoDates(filtro)
    const inicioISO = inicio.toISOString()
    const fimISO = fim.toISOString()

    const [members, wfs, obs] = await Promise.all([
      pb.collection('tenant_members').getFullList<TenantMember>({
        filter: `tenant_id = "${tenantId}"`,
        expand: 'user_id',
      }),
      pb.collection('workflows').getFullList<Workflow>({
        filter: `tenant_id = "${tenantId}" && created >= "${inicioISO}" && created <= "${fimISO}"`,
      }),
      pb.collection('obrigacoes').getFullList<ObrigacaoRecord>({
        filter: `tenant_id = "${tenantId}" && vencimento >= "${inicioISO}" && vencimento <= "${fimISO}"`,
      }),
    ])

    return members.map((m) => {
      const u = m.expand?.user_id
      const uId = u?.id || m.user_id
      const uName = u?.name || 'Usuário Sem Nome'
      const uEmail = u?.email || ''

      const userWfs = wfs.filter((w) => w.atribuido_id === uId || w.criado_por_id === uId)
      const userWfsConcluidos = userWfs.filter((w) => w.status === 'concluido')
      const userObs = obs.filter((o) => o.responsavel_id === uId)
      const userObsEntregues = userObs.filter((o) => o.status === 'entregue')
      const userObsAtrasadas = userObs.filter((o) => o.status === 'atrasada')

      // Calc average completion time in hours for concluded workflows
      let totalHoras = 0
      let concludedCount = 0
      userWfsConcluidos.forEach((w) => {
        if (w.created && w.updated) {
          const c = new Date(w.created).getTime()
          const uTime = new Date(w.updated).getTime()
          const diff = Math.max(1, (uTime - c) / (1000 * 3600))
          totalHoras += diff
          concludedCount++
        }
      })
      const avgHoras = concludedCount > 0 ? Math.round((totalHoras / concludedCount) * 10) / 10 : 0

      return {
        userId: uId,
        userName: uName,
        email: uEmail,
        perfil: m.perfil,
        workflowsTratados: userWfs.length,
        workflowsConcluidos: userWfsConcluidos.length,
        obrigacoesEntregues: userObsEntregues.length,
        obrigacoesAtrasadas: userObsAtrasadas.length,
        tempoMedioConclusaoHoras: avgHoras,
      }
    })
  },
}

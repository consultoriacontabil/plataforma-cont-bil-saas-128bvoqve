import pb from '@/lib/pocketbase/client'
import { impostosRetidosService } from '@/services/impostosRetidos'
import type { Funcionario, FolhaPagamento, EventoDp, FuncionarioStatus, ItemRubrica } from '@/types'

export interface CreateFuncionarioInput {
  tenant_id: string
  empresa: string
  nome_completo: string
  cpf: string
  cargo: string
  data_admissao: string
  data_demissao?: string
  salario: number
  tipo: 'clt' | 'pj' | 'estagio'
  status: FuncionarioStatus
  centro_custo?: string
  // Campos e-Social
  nis_pis?: string
  ctps_numero?: string
  ctps_serie?: string
  ctps_uf?: string
  cbo?: string
  grau_instrucao?: string
  raca_cor?: string
  estado_civil?: string
  sexo?: 'M' | 'F'
  data_nascimento?: string
  nome_mae?: string
  pcd?: boolean
  tipo_deficiencia?: string
  dependentes_irrf?: number
  regime_tributario_trabalhador?: string
  categoria_trabalhador?: string
  matricula_esocial?: string
}

export const dpService = {
  // === Funcionários ===
  async listFuncionarios(
    tenantId: string,
    filters?: {
      empresaId?: string
      status?: string
      busca?: string
    },
  ) {
    const filterParts: string[] = [`tenant_id = "${tenantId}"`]

    if (filters?.empresaId && filters.empresaId !== 'todas') {
      filterParts.push(`empresa = "${filters.empresaId}"`)
    }
    if (filters?.status && filters.status !== 'todos') {
      filterParts.push(`status = "${filters.status}"`)
    }
    if (filters?.busca && filters.busca.trim()) {
      const q = filters.busca.trim()
      filterParts.push(`(nome_completo ~ "${q}" || cpf ~ "${q}" || cargo ~ "${q}")`)
    }

    return pb.collection('funcionarios').getFullList<Funcionario>({
      filter: filterParts.join(' && '),
      sort: 'nome_completo',
      expand: 'empresa',
    })
  },

  async getFuncionario(id: string) {
    return pb.collection('funcionarios').getOne<Funcionario>(id, {
      expand: 'empresa',
    })
  },

  async createFuncionario(data: CreateFuncionarioInput) {
    const func = await pb.collection('funcionarios').create<Funcionario>(data)

    // Registrar automaticamente evento de admissão
    try {
      await pb.collection('eventos_dp').create<EventoDp>({
        tenant_id: data.tenant_id,
        empresa: data.empresa,
        funcionario: func.id,
        tipo: 'admissao',
        data_evento: data.data_admissao,
        descricao: `Admissão de ${data.nome_completo} no cargo ${data.cargo} (Salário: R$ ${data.salario.toFixed(2)})`,
      })
    } catch (err) {
      console.warn('Erro ao registrar evento de admissão automático:', err)
    }

    return func
  },

  async updateFuncionario(id: string, data: Partial<Funcionario>) {
    return pb.collection('funcionarios').update<Funcionario>(id, data)
  },

  async deleteFuncionario(id: string) {
    return pb.collection('funcionarios').delete(id)
  },

  // === Folha de Pagamento ===
  async listFolha(
    tenantId: string,
    filters?: {
      empresaId?: string
      competencia?: string
      status?: string
    },
  ) {
    const filterParts: string[] = [`tenant_id = "${tenantId}"`]

    if (filters?.empresaId && filters.empresaId !== 'todas') {
      filterParts.push(`empresa = "${filters.empresaId}"`)
    }
    if (filters?.competencia && filters.competencia !== 'todas') {
      filterParts.push(`competencia = "${filters.competencia}"`)
    }
    if (filters?.status && filters.status !== 'todos') {
      filterParts.push(`status = "${filters.status}"`)
    }

    return pb.collection('folha_pagamento').getFullList<FolhaPagamento>({
      filter: filterParts.join(' && '),
      sort: '-competencia,funcionario',
      expand: 'empresa,funcionario',
    })
  },

  // Processar folha para todos os funcionários ativos da empresa na competência
  async processarFolhaCompetencia(
    tenantId: string,
    empresaId: string,
    competencia: string,
  ): Promise<{ gerados: number; totalBruto: number; totalLiquido: number }> {
    // 1. Buscar funcionários ativos da empresa
    const funcs = await pb.collection('funcionarios').getFullList<Funcionario>({
      filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && status = "ativo"`,
    })

    if (funcs.length === 0) {
      return { gerados: 0, totalBruto: 0, totalLiquido: 0 }
    }

    // 2. Buscar registros já existentes na competência para não duplicar
    const existentes = await pb.collection('folha_pagamento').getFullList<FolhaPagamento>({
      filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`,
    })
    const existingFuncIds = new Set(existentes.map((e) => e.funcionario))

    let gerados = 0
    let totalBruto = 0
    let totalLiquido = 0

    for (const f of funcs) {
      if (existingFuncIds.has(f.id)) continue

      const salario = f.salario || 0
      // INSS simplificado CLT (até teto de ~R$ 908,85)
      const inss = Math.min(salario * 0.11, 908.85)
      // IRRF simplificado
      const irrf = salario > 5000 ? (salario - inss) * 0.15 : (salario - inss) * 0.075
      // FGTS (encargo patronal 8%)
      const fgts = salario * 0.08

      const proventos: ItemRubrica[] = [{ descricao: 'Salário Base', valor: salario }]
      const descontos: ItemRubrica[] = [
        { descricao: 'INSS Previdência', valor: Number(inss.toFixed(2)) },
        { descricao: 'IRRF Retido', valor: Number(irrf.toFixed(2)) },
      ]
      const liq = salario - (inss + irrf)

      await pb.collection('folha_pagamento').create<FolhaPagamento>({
        tenant_id: tenantId,
        empresa: empresaId,
        funcionario: f.id,
        competencia,
        salario_base: salario,
        proventos: JSON.stringify(proventos),
        descontos: JSON.stringify(descontos),
        inss: Number(inss.toFixed(2)),
        irrf: Number(irrf.toFixed(2)),
        fgts: Number(fgts.toFixed(2)),
        total_liquido: Number(liq.toFixed(2)),
        status: 'processada',
      })

      gerados++
      totalBruto += salario
      totalLiquido += liq
    }

    // Buscar todas as folhas da competência e sincronizar automaticamente os impostos retidos (DP -> Financeiro)
    try {
      const allFolhas = await pb.collection('folha_pagamento').getFullList<FolhaPagamento>({
        filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`,
      })

      const inssTotal = allFolhas.reduce((acc, cur) => acc + (cur.inss || 0), 0)
      const irrfTotal = allFolhas.reduce((acc, cur) => acc + (cur.irrf || 0), 0)
      const fgtsTotal = allFolhas.reduce((acc, cur) => acc + (cur.fgts || 0), 0)

      if (inssTotal > 0 || irrfTotal > 0 || fgtsTotal > 0) {
        await impostosRetidosService.gerarOuAtualizarImpostosFolha({
          tenantId,
          empresaId,
          competencia,
          inssTotal,
          irrfTotal,
          fgtsTotal,
          folhaIdRef: `folha-${competencia}`,
        })
      }
    } catch (errImp) {
      console.warn(
        'Erro ao disparar geracao automatica de impostos retidos apos calcular folha:',
        errImp,
      )
    }

    return { gerados, totalBruto, totalLiquido }
  },

  async marcarFolhaPaga(id: string) {
    const updated = await pb.collection('folha_pagamento').update<FolhaPagamento>(id, {
      status: 'paga',
      pago_em: new Date().toISOString(),
    })

    // Sincronizar impostos retidos decorrentes da folha
    try {
      const tenantId = updated.tenant_id
      const empresaId = updated.empresa
      const competencia = updated.competencia

      const allFolhas = await pb.collection('folha_pagamento').getFullList<FolhaPagamento>({
        filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`,
      })

      const inssTotal = allFolhas.reduce((acc, cur) => acc + (cur.inss || 0), 0)
      const irrfTotal = allFolhas.reduce((acc, cur) => acc + (cur.irrf || 0), 0)
      const fgtsTotal = allFolhas.reduce((acc, cur) => acc + (cur.fgts || 0), 0)

      await impostosRetidosService.gerarOuAtualizarImpostosFolha({
        tenantId,
        empresaId,
        competencia,
        inssTotal,
        irrfTotal,
        fgtsTotal,
        folhaIdRef: updated.id,
      })
    } catch (e) {
      console.warn('Erro ao atualizar impostos retidos ao marcar folha paga:', e)
    }

    return updated
  },

  async marcarLoteFolhaPaga(ids: string[]) {
    const now = new Date().toISOString()
    const results = await Promise.all(
      ids.map((id) =>
        pb.collection('folha_pagamento').update<FolhaPagamento>(id, {
          status: 'paga',
          pago_em: now,
        }),
      ),
    )

    // Sincronizar impostos retidos decorrentes para as empresas/competências afetadas
    try {
      const pares = new Map<string, { tenantId: string; empresaId: string; competencia: string }>()
      for (const f of results) {
        pares.set(`${f.empresa}-${f.competencia}`, {
          tenantId: f.tenant_id,
          empresaId: f.empresa,
          competencia: f.competencia,
        })
      }

      for (const par of pares.values()) {
        const allFolhas = await pb.collection('folha_pagamento').getFullList<FolhaPagamento>({
          filter: `tenant_id = "${par.tenantId}" && empresa = "${par.empresaId}" && competencia = "${par.competencia}"`,
        })
        const inssTotal = allFolhas.reduce((acc, cur) => acc + (cur.inss || 0), 0)
        const irrfTotal = allFolhas.reduce((acc, cur) => acc + (cur.irrf || 0), 0)
        const fgtsTotal = allFolhas.reduce((acc, cur) => acc + (cur.fgts || 0), 0)

        await impostosRetidosService.gerarOuAtualizarImpostosFolha({
          tenantId: par.tenantId,
          empresaId: par.empresaId,
          competencia: par.competencia,
          inssTotal,
          irrfTotal,
          fgtsTotal,
          folhaIdRef: `folha-${par.competencia}`,
        })
      }
    } catch (e) {
      console.warn('Erro ao sincronizar impostos retidos apos marcar lote pago:', e)
    }

    return results
  },

  // === Eventos de DP ===
  async listEventos(
    tenantId: string,
    filters?: {
      empresaId?: string
      funcionarioId?: string
      tipo?: string
    },
  ) {
    const filterParts: string[] = [`tenant_id = "${tenantId}"`]

    if (filters?.empresaId && filters.empresaId !== 'todas') {
      filterParts.push(`empresa = "${filters.empresaId}"`)
    }
    if (filters?.funcionarioId && filters.funcionarioId !== 'todos') {
      filterParts.push(`funcionario = "${filters.funcionarioId}"`)
    }
    if (filters?.tipo && filters.tipo !== 'todos') {
      filterParts.push(`tipo = "${filters.tipo}"`)
    }

    return pb.collection('eventos_dp').getFullList<EventoDp>({
      filter: filterParts.join(' && '),
      sort: '-data_evento',
      expand: 'empresa,funcionario,anexo',
    })
  },

  async createEvento(data: Partial<EventoDp>) {
    const ev = await pb.collection('eventos_dp').create<EventoDp>(data)

    // Se o evento impactar o status do funcionário, atualizar
    if (data.funcionario && data.tipo) {
      if (data.tipo === 'demissao') {
        await pb.collection('funcionarios').update(data.funcionario, {
          status: 'demitido',
          data_demissao: data.data_evento,
        })
      } else if (data.tipo === 'ferias') {
        await pb.collection('funcionarios').update(data.funcionario, {
          status: 'ferias',
        })
      } else if (data.tipo === 'afastado') {
        await pb.collection('funcionarios').update(data.funcionario, {
          status: 'afastado',
        })
      }
    }

    return ev
  },

  async deleteEvento(id: string) {
    return pb.collection('eventos_dp').delete(id)
  },
}

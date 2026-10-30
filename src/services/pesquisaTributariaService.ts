import pb from '@/lib/pocketbase/client'

export type PesquisaTributariaStatus = 'em_analise' | 'concluida' | 'revisao_necessaria' | 'erro'

export interface FonteTributaria {
  titulo: string
  tipo?:
    | 'lei'
    | 'decreto'
    | 'instrucao_normativa'
    | 'solucao_consulta'
    | 'convenio_icms'
    | 'artigo'
    | 'outro'
  numero?: string
  ano?: string | number
  orgao?: string
  link?: string
  trecho?: string
}

export interface PesquisaTributariaContexto {
  ncm?: string
  cfop?: string
  operacao?: string
  uf_origem?: string
  uf_destino?: string
  aliquota_estudo?: string
  regime_tributario?: string
  beneficio_fiscal?: string
  competencia?: string
  detalhes_operacao?: string
  [key: string]: unknown
}

export interface PesquisaTributaria {
  id: string
  tenant_id: string
  empresa_id?: string
  pergunta: string
  contexto?: PesquisaTributariaContexto
  relatorio_tecnico?: string
  fontes?: FonteTributaria[]
  conclusoes?: string
  status: PesquisaTributariaStatus
  criado_por_comando_id?: string
  autorizado_por?: string
  evidencias?: string[]
  metadados_json?: Record<string, unknown>
  created: string
  updated: string
  expand?: {
    empresa_id?: {
      id: string
      razao_social: string
      nome_fantasia?: string
      cnpj: string
      regime_tributario?: string
      uf?: string
    }
    criado_por_comando_id?: {
      id: string
      nonce: string
      status: string
      agente?: string
      erro?: Record<string, unknown>
    }
  }
}

export interface FiltrosPesquisaTributaria {
  tenantId: string
  empresaId?: string
  competencia?: string
  status?: string
  termo?: string
  limit?: number
}

export const pesquisaTributariaService = {
  async listar(filtros: FiltrosPesquisaTributaria): Promise<PesquisaTributaria[]> {
    if (!filtros.tenantId) return []

    const conditions: string[] = [`tenant_id = "${filtros.tenantId}"`]

    if (filtros.empresaId && filtros.empresaId !== 'todas') {
      conditions.push(`empresa_id = "${filtros.empresaId}"`)
    }

    if (filtros.status && filtros.status !== 'todos') {
      conditions.push(`status = "${filtros.status}"`)
    }

    if (filtros.termo) {
      const termoSanitizado = filtros.termo.replace(/"/g, '')
      conditions.push(`pergunta ~ "${termoSanitizado}" || relatorio_tecnico ~ "${termoSanitizado}"`)
    }

    const filterString = conditions.join(' && ')

    try {
      const result = await pb
        .collection('pesquisas_tributarias')
        .getList<PesquisaTributaria>(1, filtros.limit || 50, {
          filter: filterString,
          sort: '-created',
          expand: 'empresa_id,criado_por_comando_id',
        })
      return result.items
    } catch (err) {
      console.error('[pesquisaTributariaService] Erro ao listar pesquisas tributárias:', err)
      return []
    }
  },

  async obterPorId(id: string): Promise<PesquisaTributaria | null> {
    if (!id) return null
    try {
      return await pb.collection('pesquisas_tributarias').getOne<PesquisaTributaria>(id, {
        expand: 'empresa_id,criado_por_comando_id',
      })
    } catch (err) {
      console.error('[pesquisaTributariaService] Erro ao obter pesquisa tributária:', err)
      return null
    }
  },

  async obterPorComandoId(comandoId: string): Promise<PesquisaTributaria | null> {
    if (!comandoId) return null
    try {
      const records = await pb
        .collection('pesquisas_tributarias')
        .getList<PesquisaTributaria>(1, 1, {
          filter: `criado_por_comando_id = "${comandoId}"`,
          sort: '-created',
          expand: 'empresa_id,criado_por_comando_id',
        })
      return records.items[0] || null
    } catch (err) {
      console.error('[pesquisaTributariaService] Erro ao obter por criado_por_comando_id:', err)
      return null
    }
  },
}

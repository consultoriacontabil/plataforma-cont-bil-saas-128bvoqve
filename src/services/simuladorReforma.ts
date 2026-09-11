import pb from '@/lib/pocketbase/client'
import type { SimulacaoReformaRecord } from '@/types'
import type { SimulacaoCalculada } from '@/lib/reformaTributaria/calculos'

export interface ReceitaRealResultado {
  sucesso: boolean
  faturamentoTotal: number
  periodoDescricao: string
  quantidadeLancamentos: number
  competenciasConsideradas: string[]
  detalhesPorConta: { contaCodigo: string; contaNome: string; totalCreditos: number }[]
  mensagem?: string
}

export interface SalvarSimulacaoInput {
  tenantId: string
  empresaId?: string
  titulo: string
  razaoSocial?: string
  cnpj?: string
  regimeAtual: 'simples_nacional' | 'lucro_presumido' | 'lucro_real'
  setorAtividade: string
  faturamentoAnual: number
  aliquotaAtualEstimada: number
  percentualCreditos?: number
  reducaoSetorial60?: boolean
  vendeCestaBasica?: boolean
  calculada: SimulacaoCalculada
  compartilhadoPortal?: boolean
  criadoPor?: string
}

export const simuladorReformaService = {
  async list(tenantId: string, empresaId?: string): Promise<SimulacaoReformaRecord[]> {
    let filter = `tenant_id = "${tenantId}"`
    if (empresaId) {
      filter += ` && empresa = "${empresaId}"`
    }
    const records = await pb.collection('simulacoes_reforma').getFullList<SimulacaoReformaRecord>({
      filter,
      sort: '-created',
      expand: 'empresa,criado_por',
    })
    return records
  },

  async getById(id: string): Promise<SimulacaoReformaRecord> {
    return await pb.collection('simulacoes_reforma').getOne<SimulacaoReformaRecord>(id, {
      expand: 'empresa,criado_por',
    })
  },

  async create(data: SalvarSimulacaoInput): Promise<SimulacaoReformaRecord> {
    const payload = {
      tenant_id: data.tenantId,
      empresa: data.empresaId || null,
      titulo: data.titulo,
      razao_social: data.razaoSocial || '',
      cnpj: data.cnpj || '',
      regime_atual: data.regimeAtual,
      setor_atividade: data.setorAtividade,
      faturamento_anual: data.faturamentoAnual,
      aliquota_atual_estimada: data.aliquotaAtualEstimada,
      percentual_creditos: data.percentualCreditos || 0,
      reducao_setorial_60: !!data.reducaoSetorial60,
      vende_cesta_basica: !!data.vendeCestaBasica,
      inputs_json: data.calculada.inputs,
      resultado_json: {
        resumo: data.calculada.resumo,
        tabelaAnual: data.calculada.tabelaAnual,
        parametrosUtilizados: data.calculada.parametrosUtilizados,
      },
      compartilhado_portal: !!data.compartilhadoPortal,
      criado_por: data.criadoPor || null,
    }

    const created = await pb
      .collection('simulacoes_reforma')
      .create<SimulacaoReformaRecord>(payload)

    // Trilha de auditoria
    try {
      await pb.collection('audit_log').create({
        tenant_id: data.tenantId,
        usuario_id: data.criadoPor || null,
        acao: 'CRIAR_SIMULACAO_REFORMA',
        entidade_tipo: 'simulacoes_reforma',
        entidade_id: created.id,
        detalhes: `Simulação da Reforma criada: "${data.titulo}" para ${data.razaoSocial || 'Análise Avulsa'}`,
      })
    } catch (err) {
      console.warn('Falha ao registrar auditoria de simulação:', err)
    }

    return created
  },

  async togglePortalShare(
    id: string,
    compartilhado: boolean,
    tenantId: string,
    userId?: string,
  ): Promise<SimulacaoReformaRecord> {
    const updated = await pb.collection('simulacoes_reforma').update<SimulacaoReformaRecord>(id, {
      compartilhado_portal: compartilhado,
    })

    try {
      await pb.collection('audit_log').create({
        tenant_id: tenantId,
        usuario_id: userId || null,
        acao: 'COMPARTILHAR_SIMULACAO_PORTAL',
        entidade_tipo: 'simulacoes_reforma',
        entidade_id: id,
        detalhes: `Status de compartilhamento no portal alterado para: ${compartilhado ? 'Sim' : 'Não'}`,
      })
    } catch {
      /* intentionally ignored */
    }

    return updated
  },

  async delete(id: string, tenantId: string, userId?: string): Promise<boolean> {
    await pb.collection('simulacoes_reforma').delete(id)
    try {
      await pb.collection('audit_log').create({
        tenant_id: tenantId,
        usuario_id: userId || null,
        acao: 'EXCLUIR_SIMULACAO_REFORMA',
        entidade_tipo: 'simulacoes_reforma',
        entidade_id: id,
        detalhes: `Simulação de reforma ID ${id} excluída.`,
      })
    } catch {
      /* intentionally ignored */
    }
    return true
  },

  /**
   * Consulta os lançamentos contábeis reais da empresa (plano de contas do tipo receita)
   * Agrupa pelo último exercício fechado ou pelos últimos meses com lançamentos confirmados
   */
  async obterReceitaRealExercicio(
    tenantId: string,
    empresaId: string,
  ): Promise<ReceitaRealResultado> {
    try {
      // 1. Obter todas as contas de receitas ativas
      const contasReceita = await pb.collection('plano_contas').getFullList({
        filter: `tenant_id = "${tenantId}" && tipo = "receita" && ativa = true`,
        sort: 'codigo',
      })

      if (!contasReceita || contasReceita.length === 0) {
        return {
          sucesso: false,
          faturamentoTotal: 0,
          periodoDescricao: '',
          quantidadeLancamentos: 0,
          competenciasConsideradas: [],
          detalhesPorConta: [],
          mensagem: 'Nenhuma conta de receita encontrada no plano de contas.',
        }
      }

      const contasReceitaMap = new Map<string, { codigo: string; nome: string }>()
      for (const cr of contasReceita) {
        contasReceitaMap.set(cr.id, { codigo: cr.codigo, nome: cr.nome })
      }

      // 2. Buscar lançamentos confirmados da empresa
      const lancamentos = await pb.collection('lancamentos_contabeis').getFullList({
        filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && status = "confirmado"`,
        sort: '-data,-created',
      })

      if (!lancamentos || lancamentos.length === 0) {
        return {
          sucesso: false,
          faturamentoTotal: 0,
          periodoDescricao: '',
          quantidadeLancamentos: 0,
          competenciasConsideradas: [],
          detalhesPorConta: [],
          mensagem: 'A empresa não possui lançamentos contábeis confirmados registrados.',
        }
      }

      // 3. Filtrar lançamentos que movimentam as contas de receita
      // Receitas aumentam por crédito. Lançamentos onde tipo == 'credito' e conta_contabil é receita
      // e lançamentos onde tipo == 'debito' e contrapartida é receita (para partidas dobradas)
      const lancamentosReceita = lancamentos.filter((l) => {
        const isContaReceita = contasReceitaMap.has(l.conta_contabil)
        if (isContaReceita && l.tipo === 'credito') return true

        // Se for um estorno ou contrapartida direta:
        const isContrapartidaReceita = contasReceitaMap.has(l.contrapartida)
        if (isContrapartidaReceita && l.tipo === 'debito') return true

        return false
      })

      if (lancamentosReceita.length === 0) {
        return {
          sucesso: false,
          faturamentoTotal: 0,
          periodoDescricao: '',
          quantidadeLancamentos: 0,
          competenciasConsideradas: [],
          detalhesPorConta: [],
          mensagem:
            'Nenhuma receita operacional ou de vendas foi identificada nos lançamentos desta empresa.',
        }
      }

      // 4. Identificar anos ou competências disponíveis
      // Competência costuma ser MM/YYYY ou YYYY-MM ou extraída de data
      const compsSet = new Set<string>()
      const anosSet = new Set<string>()

      for (const l of lancamentosReceita) {
        if (l.competencia) {
          compsSet.add(l.competencia)
          const parts = l.competencia.split('/')
          if (parts.length === 2 && parts[1]) {
            anosSet.add(parts[1])
          } else if (l.competencia.length === 4) {
            anosSet.add(l.competencia)
          }
        } else if (l.data) {
          const ano = new Date(l.data).getFullYear().toString()
          anosSet.add(ano)
        }
      }

      // Ordena anos de forma decrescente
      const anosOrdenados = Array.from(anosSet).sort((a, b) => Number(b) - Number(a))
      const ultimoAno = anosOrdenados[0]

      // Seleciona lançamentos do último ano com movimento (ou todos os últimos até 12 meses)
      const lancamentosConsiderados = ultimoAno
        ? lancamentosReceita.filter((l) => {
            if (l.competencia && l.competencia.includes(ultimoAno)) return true
            if (l.data && new Date(l.data).getFullYear().toString() === ultimoAno) return true
            return false
          })
        : lancamentosReceita

      let total = 0
      const contasAgregadas: Record<string, { codigo: string; nome: string; total: number }> = {}
      const compsConsideradas = new Set<string>()

      for (const l of lancamentosConsiderados) {
        const valor = Number(l.valor) || 0
        total += valor
        if (l.competencia) compsConsideradas.add(l.competencia)

        const contaId = contasReceitaMap.has(l.conta_contabil) ? l.conta_contabil : l.contrapartida
        const contaInfo = contasReceitaMap.get(contaId)

        if (contaInfo) {
          if (!contasAgregadas[contaId]) {
            contasAgregadas[contaId] = {
              codigo: contaInfo.codigo,
              nome: contaInfo.nome,
              total: 0,
            }
          }
          contasAgregadas[contaId].total += valor
        }
      }

      const detalhesPorConta = Object.values(contasAgregadas).map((c) => ({
        contaCodigo: c.codigo,
        contaNome: c.nome,
        totalCreditos: Math.round(c.total * 100) / 100,
      }))

      const compsArray = Array.from(compsConsideradas).sort()
      const periodoDesc = ultimoAno
        ? `Exercício ${ultimoAno} (${compsArray.join(', ') || 'anual'})`
        : `Últimos lançamentos (${compsArray.join(', ') || 'período recente'})`

      return {
        sucesso: total > 0,
        faturamentoTotal: Math.round(total * 100) / 100,
        periodoDescricao: periodoDesc,
        quantidadeLancamentos: lancamentosConsiderados.length,
        competenciasConsideradas: compsArray,
        detalhesPorConta,
      }
    } catch (err: any) {
      console.error('Erro ao consultar receita real da empresa:', err)
      return {
        sucesso: false,
        faturamentoTotal: 0,
        periodoDescricao: '',
        quantidadeLancamentos: 0,
        competenciasConsideradas: [],
        detalhesPorConta: [],
        mensagem:
          err?.message || 'Falha na comunicação ao buscar lançamentos contábeis da empresa.',
      }
    }
  },
}

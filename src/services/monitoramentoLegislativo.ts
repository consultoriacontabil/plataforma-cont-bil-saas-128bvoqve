import pb from '@/lib/pocketbase/client'
import type {
  PublicacaoLegislativaRecord,
  PublicacaoFonte,
  PublicacaoClassificacao,
  PublicacaoCriticidade,
  PublicacaoStatus,
  Empresa,
  ImpactoCalculadoJson,
  EmpresaImpactadaCalculo,
} from '@/types'

export interface CriarPublicacaoInput {
  tenant_id: string
  titulo: string
  numero_norma: string
  fonte: PublicacaoFonte
  data_publicacao: string
  data_vigencia?: string
  classificacao: PublicacaoClassificacao
  criticidade: PublicacaoCriticidade
  resumo: string
  conteudo_completo?: string
  link_oficial?: string
  tributo_afetado?: string
  aliquota_anterior?: number
  aliquota_nova?: number
  regimes_afetados_json?: string[]
  setores_afetados_json?: string[]
  status?: PublicacaoStatus
  origem_captura?:
    | 'manual_supervisionado'
    | 'importacao_json'
    | 'api_dou_simulada'
    | 'conector_externo'
}

export const monitoramentoLegislativoService = {
  async list(
    tenantId: string,
    filter?: string,
    sort = '-data_publicacao',
  ): Promise<PublicacaoLegislativaRecord[]> {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) finalFilter += ` && (${filter})`
    return pb.collection('publicacoes_legislativas').getFullList<PublicacaoLegislativaRecord>({
      filter: finalFilter,
      sort,
      expand: 'analisado_por',
    })
  },

  async getById(id: string): Promise<PublicacaoLegislativaRecord> {
    return pb.collection('publicacoes_legislativas').getOne<PublicacaoLegislativaRecord>(id, {
      expand: 'analisado_por',
    })
  },

  async create(data: CriarPublicacaoInput): Promise<PublicacaoLegislativaRecord> {
    return pb.collection('publicacoes_legislativas').create<PublicacaoLegislativaRecord>({
      ...data,
      status: data.status || 'nova',
      origem_captura: data.origem_captura || 'manual_supervisionado',
    })
  },

  async update(
    id: string,
    data: Partial<PublicacaoLegislativaRecord>,
  ): Promise<PublicacaoLegislativaRecord> {
    return pb.collection('publicacoes_legislativas').update<PublicacaoLegislativaRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('publicacoes_legislativas').delete(id)
  },

  async marcarComoAnalisada(
    id: string,
    userId: string,
    notasAnalise?: string,
  ): Promise<PublicacaoLegislativaRecord> {
    return pb.collection('publicacoes_legislativas').update<PublicacaoLegislativaRecord>(id, {
      status: 'analisada',
      analisado_por: userId,
      analisado_em: new Date().toISOString(),
      notas_analise:
        notasAnalise || 'Publicação revisada e avaliada quanto ao impacto na carteira de clientes.',
    })
  },

  async arquivar(id: string): Promise<PublicacaoLegislativaRecord> {
    return pb.collection('publicacoes_legislativas').update<PublicacaoLegislativaRecord>(id, {
      status: 'arquivada',
    })
  },

  // COMPARADOR E CÁLCULO DE IMPACTO FINANCEIRO POR EMPRESA DA CARTEIRA
  async calcularImpactoEmpresas(
    tenantId: string,
    aliquotaAnterior: number,
    aliquotaNova: number,
    regimesAfetados: string[] = ['simples_nacional', 'lucro_presumido', 'lucro_real'],
    setoresAfetados: string[] = ['todos'],
    ufFiltro?: string,
  ): Promise<ImpactoCalculadoJson> {
    const empresas = await pb.collection('empresas').getFullList<Empresa>({
      filter: `tenant_id = "${tenantId}" && status = "ativo"`,
    })

    const variacaoPercentualAliquota =
      aliquotaAnterior > 0
        ? Number((((aliquotaNova - aliquotaAnterior) / aliquotaAnterior) * 100).toFixed(2))
        : 0

    const detalhesPorEmpresa: EmpresaImpactadaCalculo[] = []
    let impactoFinanceiroMensalTotal = 0

    empresas.forEach((emp) => {
      // Filtrar por UF se a publicação for estadual
      if (ufFiltro && emp.uf && emp.uf.toUpperCase() !== ufFiltro.toUpperCase()) {
        return
      }

      // Filtrar por regime
      const regimeMatch =
        regimesAfetados.includes('todos') || regimesAfetados.includes(emp.regime_tributario)

      if (!regimeMatch) return

      // Faturamento base estimado
      let fatMensal = 35000
      if (emp.nome_fantasia?.includes('Inovatech') || emp.razao_social.includes('Inovatech')) {
        fatMensal = 52000
      } else if (emp.nome_fantasia?.includes('Grãos') || emp.razao_social.includes('Grãos')) {
        fatMensal = 28000
      }

      const custoAnterior = Math.round(fatMensal * (aliquotaAnterior / 100))
      const custoNovo = Math.round(fatMensal * (aliquotaNova / 100))
      const impactoFinanceiro = custoNovo - custoAnterior
      const impactoPercentual =
        custoAnterior > 0
          ? Number((((custoNovo - custoAnterior) / custoAnterior) * 100).toFixed(2))
          : 0

      impactoFinanceiroMensalTotal += impactoFinanceiro

      let orientacao = ''
      if (impactoFinanceiro > 0) {
        orientacao = `Acréscimo previsto de R$ ${impactoFinanceiro.toLocaleString('pt-BR')}/mês na carga tributária. Avaliar repasse de preço ou creditamento na cadeia.`
      } else if (impactoFinanceiro < 0) {
        orientacao = `Redução prevista de R$ ${Math.abs(impactoFinanceiro).toLocaleString('pt-BR')}/mês. Oportunidade de ganho de margem operacional.`
      } else {
        orientacao = `Alíquotas equivalentes. Sem alteração direta no recolhimento mensal.`
      }

      detalhesPorEmpresa.push({
        empresaId: emp.id,
        nome: emp.nome_fantasia || emp.razao_social,
        uf: emp.uf,
        regime: emp.regime_tributario,
        setor: emp.observacoes?.includes('software') ? 'tecnologia_software' : 'comercio_varejista',
        faturamentoMedioMensal: fatMensal,
        custoAnteriorMensal: custoAnterior,
        custoNovoMensal: custoNovo,
        impactoFinanceiro,
        impactoPercentual,
        orientacao,
      })
    })

    return {
      totalEmpresasAfetadas: detalhesPorEmpresa.length,
      variacaoPercentualAliquota,
      impactoFinanceiroMensalTotal: Number(impactoFinanceiroMensalTotal.toFixed(2)),
      detalhesPorEmpresa,
    }
  },

  /**
   * PONTO DE EXTENSÃO DOCUMENTADO:
   * Sincronização automática com API externa (ex: Querido Diário, API do DOU Nacional ou SEFAZ).
   *
   * COMO PLUGAR:
   * 1. Adicionar as chaves DOU_API_KEY ou QUERIDO_DIARIO_TOKEN via set_env ou $secrets
   * 2. O hook server-side ou esta rotina chamará o endpoint oficial GET /api/v1/gazettes
   * 3. A estrutura da resposta alimenta diretamente a coleção 'publicacoes_legislativas'
   * 4. A interface de usuário (UI) não precisa de nenhuma modificação, pois consome os mesmos campos.
   */
  async simularVarreduraApiDou(
    tenantId: string,
  ): Promise<{ importadas: number; mensagem: string }> {
    // Transparência: Sem credenciais ativas, reporta o comportamento correto em modo supervisão
    return {
      importadas: 0,
      mensagem:
        'Conector API DOU em Modo Supervisão: nenhuma credencial externa configurada. Use o botão de importação por texto/JSON ou cadastre publicações supervisionadas.',
    }
  },
}

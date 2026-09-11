import pb from '@/lib/pocketbase/client'
import type {
  ContratoHonorarioRecord,
  TipoContratoHonorario,
  StatusContratoHonorario,
  ClausulaContrato,
  DadosCongeladosContrato,
} from '@/types'

export const MODELO_CLAUSULAS_PADRAO: ClausulaContrato[] = [
  {
    titulo: 'Cláusula 1ª — Do Objeto e Escopo dos Serviços',
    texto:
      'O presente instrumento tem por objeto a prestação de serviços contábeis, tributários, fiscais e trabalhistas pela CONTRATADA em favor da CONTRATANTE, compreendendo: escrituração contábil regular (Livros Diário e Razão), conciliação bancária mensal, apuração dos tributos incidentes e emissão de guias de recolhimento (DAS, ICMS, ISS, IRPJ, CSLL, PIS, COFINS), processamento mensal de folha de pagamento e pró-labore, e transmissão tempestiva de todas as obrigações acessórias normativas aos órgãos competentes (SPED, DCTF, ECF, ECD, e-Social, FGTS Digital).',
  },
  {
    titulo: 'Cláusula 2ª — Dos Honorários e Forma de Pagamento',
    texto:
      'Pelos serviços profissionais ora pactuados, a CONTRATANTE pagará à CONTRATADA a mensalidade estipulada neste documento, com vencimento impreterivelmente no dia estipulado de cada mês civil, via boleto bancário ou chave PIX de titularidade do escritório contábil. Serviços extraordinários como alteração contratual societária, abertura de filiais, parcelamentos especiais e auditoria específica serão orçados em aditivo apartado.',
  },
  {
    titulo: 'Cláusula 3ª — Do Reajuste Anual pela Inflação',
    texto:
      'Os honorários mensais serão reajustados a cada período de 12 (doze) meses contados da data de início de vigência, pela variação acumulada do IPCA (Índice Nacional de Preços ao Consumidor Amplo) medido pelo IBGE ou, na impossibilidade de sua apuração, pelo índice oficial substituto, visando à manutenção do equilíbrio econômico da avença.',
  },
  {
    titulo: 'Cláusula 4ª — Das Obrigações da Contratante',
    texto:
      'Compete à CONTRATANTE disponibilizar e encaminhar à CONTRATADA, impreterivelmente até o 5º (quinto) dia útil do mês subsequente ao fato gerador, todos os extratos bancários em formato digital, comprovantes de despesas, notas fiscais de entrada/saída, informações de admissões/demissões e quaisquer atos corporativos hábeis, respondendo exclusivamente por juros e multas decorrentes de atrasos na entrega dos subsídios.',
  },
  {
    titulo: 'Cláusula 5ª — Da Confidencialidade e LGPD (Lei 13.709/2018)',
    texto:
      'As partes obrigam-se a manter rigoroso sigilo acerca de quaisquer segredos de negócio, dados contábeis, balanços e dados pessoais trocados em virtude deste contrato, cumprindo com zelo as disposições da Lei Geral de Proteção de Dados (LGPD) e o Código de Ética Profissional do Contabilista (Resolução CFC nº 803/1996).',
  },
  {
    titulo: 'Cláusula 6ª — Do Prazo e Rescisão Contratual',
    texto:
      'O presente contrato vigerá pelo prazo acordado a contar de sua data de início. Findo o prazo, prorroga-se automaticamente por tempo indeterminado se não houver manifestação em contrário. Qualquer das partes poderá rescindir o pacto mediante notificação formal com antecedência mínima de 30 (trinta) dias, sem incidência de multa indenizatória, procedendo à transferência formal do acervo técnico contábil.',
  },
  {
    titulo: 'Cláusula 7ª — Da Integridade e Assinatura Digital',
    texto:
      'As partes declaram a plena validade jurídica das assinaturas eletrônicas e digitais apostas neste instrumento através da plataforma de gestão contábil Rumo, outorgando eficácia executiva com suporte em carimbo de tempo, IP e hash criptográfico SHA-256, conforme preceituam a MP nº 2.200-2/2001 e a Lei Federal nº 14.063/2020.',
  },
  {
    titulo: 'Cláusula 8ª — Do Foro de Eleição',
    texto:
      'Para dirimir controvérsias oriundas do presente contrato, fica eleito o Foro da Comarca da sede da CONTRATADA, com renúncia expressa a qualquer outro, por mais privilegiado que se apresente.',
  },
]

export interface SalvarContratoInput {
  tenantId: string
  empresaId?: string
  titulo: string
  tipo: TipoContratoHonorario
  modeloMensalidade: string
  valorMensal: number
  diaVencimento: number
  prazoContrato: number
  dataInicio?: string
  clausulas: ClausulaContrato[]
  status?: StatusContratoHonorario
  observacoesRecusa?: string
  criadoPor?: string
}

export const contratosService = {
  // Listar contratos e propostas do escritório
  async list(
    tenantId: string,
    filters?: {
      empresaId?: string
      tipo?: TipoContratoHonorario | 'todos'
      status?: StatusContratoHonorario | 'todos'
      search?: string
    },
  ): Promise<ContratoHonorarioRecord[]> {
    const parts = [`tenant_id = "${tenantId}"`]

    if (filters?.empresaId && filters.empresaId !== 'todas') {
      parts.push(`empresa = "${filters.empresaId}"`)
    }
    if (filters?.tipo && filters.tipo !== 'todos') {
      parts.push(`tipo = "${filters.tipo}"`)
    }
    if (filters?.status && filters.status !== 'todos') {
      parts.push(`status = "${filters.status}"`)
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().replace(/"/g, '')
      parts.push(`titulo ~ "${q}" || modelo_mensalidade ~ "${q}"`)
    }

    return pb.collection('contratos_honorarios').getFullList<ContratoHonorarioRecord>({
      filter: parts.join(' && '),
      sort: '-created',
      expand: 'empresa,criado_por',
    })
  },

  // Obter contrato individual por ID
  async getById(id: string): Promise<ContratoHonorarioRecord> {
    return pb.collection('contratos_honorarios').getOne<ContratoHonorarioRecord>(id, {
      expand: 'empresa,criado_por',
    })
  },

  // Criar novo rascunho de proposta ou contrato
  async create(input: SalvarContratoInput): Promise<ContratoHonorarioRecord> {
    const payload: Record<string, unknown> = {
      tenant_id: input.tenantId,
      titulo: input.titulo.trim(),
      tipo: input.tipo,
      modelo_mensalidade: input.modeloMensalidade.trim(),
      valor_mensal: input.valorMensal || 0,
      dia_vencimento: input.diaVencimento || 10,
      prazo_contrato: input.prazoContrato || 12,
      data_inicio: input.dataInicio ? new Date(input.dataInicio).toISOString() : undefined,
      clausulas: input.clausulas,
      status: input.status || 'rascunho',
      observacoes_recusa: '',
    }

    if (input.empresaId && input.empresaId !== 'nenhuma') {
      payload.empresa = input.empresaId
    }
    if (input.criadoPor) {
      payload.criado_por = input.criadoPor
    }

    return pb.collection('contratos_honorarios').create<ContratoHonorarioRecord>(payload, {
      expand: 'empresa,criado_por',
    })
  },

  // Atualizar proposta ou contrato existente
  async update(id: string, input: Partial<SalvarContratoInput>): Promise<ContratoHonorarioRecord> {
    const payload: Record<string, unknown> = {}

    if (input.titulo !== undefined) payload.titulo = input.titulo.trim()
    if (input.tipo !== undefined) payload.tipo = input.tipo
    if (input.modeloMensalidade !== undefined)
      payload.modelo_mensalidade = input.modeloMensalidade.trim()
    if (input.valorMensal !== undefined) payload.valor_mensal = input.valorMensal
    if (input.diaVencimento !== undefined) payload.dia_vencimento = input.diaVencimento
    if (input.prazoContrato !== undefined) payload.prazo_contrato = input.prazoContrato
    if (input.dataInicio !== undefined) {
      payload.data_inicio = input.dataInicio ? new Date(input.dataInicio).toISOString() : null
    }
    if (input.clausulas !== undefined) payload.clausulas = input.clausulas
    if (input.status !== undefined) payload.status = input.status
    if (input.observacoesRecusa !== undefined) payload.observacoes_recusa = input.observacoesRecusa
    if (input.empresaId !== undefined) {
      payload.empresa = input.empresaId === 'nenhuma' ? null : input.empresaId
    }

    return pb.collection('contratos_honorarios').update<ContratoHonorarioRecord>(id, payload, {
      expand: 'empresa,criado_por',
    })
  },

  // Congelar dados e Enviar ao Cliente para validação e assinatura
  async enviarAoCliente(
    contratoId: string,
    dadosCongelados: DadosCongeladosContrato,
  ): Promise<ContratoHonorarioRecord> {
    return pb.collection('contratos_honorarios').update<ContratoHonorarioRecord>(
      contratoId,
      {
        status: 'enviado',
        dados_congelados: dadosCongelados,
        observacoes_recusa: '',
      },
      { expand: 'empresa,criado_por' },
    )
  },

  // Cliente recusa a proposta ou contrato com justificativa obrigatória
  async recusar(contratoId: string, justificativa: string): Promise<ContratoHonorarioRecord> {
    if (!justificativa.trim()) {
      throw new Error('A justificativa da recusa é obrigatória.')
    }
    return pb.collection('contratos_honorarios').update<ContratoHonorarioRecord>(
      contratoId,
      {
        status: 'recusado',
        observacoes_recusa: justificativa.trim(),
      },
      { expand: 'empresa,criado_por' },
    )
  },

  // Cancelar contrato
  async cancelar(contratoId: string): Promise<ContratoHonorarioRecord> {
    return pb
      .collection('contratos_honorarios')
      .update<ContratoHonorarioRecord>(
        contratoId,
        { status: 'cancelado' },
        { expand: 'empresa,criado_por' },
      )
  },

  // Excluir rascunho
  async delete(contratoId: string): Promise<boolean> {
    return pb.collection('contratos_honorarios').delete(contratoId)
  },
}

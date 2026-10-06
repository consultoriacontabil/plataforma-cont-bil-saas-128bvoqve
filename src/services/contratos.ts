import pb from '@/lib/pocketbase/client'
import type {
  ContratoHonorarioRecord,
  TipoContratoHonorario,
  StatusContratoHonorario,
  ClausulaContrato,
  DadosCongeladosContrato,
  FluxoVinculadoTipo,
  ItemDocumentoTrilha,
} from '@/types'
import { auditService } from '@/services/audit'

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

/**
 * Checklist de documentos para o fluxo de ABERTURA com atribuição explícita de responsabilidade:
 * - "cliente": Documentos que o cliente precisa anexar (RG sócios, IPTU, etc.)
 * - "contabilidade": Responsabilidade do escritório (Elaboração do Contrato Social, Viabilidade, DBE, Taxa DARE)
 */
export const CHECKLIST_DOCUMENTOS_ABERTURA_PADRAO: ItemDocumentoTrilha[] = [
  {
    id: 'abert_doc_01',
    titulo: 'Documento de Identificação dos Sócios (RG/CNH + CPF)',
    descricao: 'Cópia digitalizada legível com foto recente e CPF dos sócios administradores.',
    categoria: 'socios',
    responsavel: 'cliente',
    obrigatorio: true,
    status: 'pendente',
  },
  {
    id: 'abert_doc_02',
    titulo: 'Comprovante de Residência dos Sócios (máx. 90 dias)',
    descricao: 'Conta de consumo (energia, água ou gás) recente no nome do sócio.',
    categoria: 'socios',
    responsavel: 'cliente',
    obrigatorio: true,
    status: 'pendente',
  },
  {
    id: 'abert_doc_03',
    titulo: 'Carnê do IPTU do Imóvel Sede (Inscrição Imobiliária)',
    descricao:
      'Folha do carnê de IPTU com a metragem e número da inscrição municipal do imóvel sede.',
    categoria: 'empresa',
    responsavel: 'cliente',
    obrigatorio: true,
    status: 'pendente',
  },
  {
    id: 'abert_doc_04',
    titulo: 'Consulta Prévia de Viabilidade Locacional (Prefeitura/Redesim)',
    descricao:
      'Protocolo e despacho de viabilidade aprovada pelo município para o endereço pretendido.',
    categoria: 'viabilidade',
    responsavel: 'contabilidade',
    obrigatorio: true,
    status: 'pendente',
  },
  {
    id: 'abert_doc_05',
    titulo: 'Minuta do Contrato Social / Ato Constitutivo Unipessoal',
    descricao: 'Redação técnica contábil das cláusulas sociais, objeto, CNAEs e capital social.',
    categoria: 'societario',
    responsavel: 'contabilidade',
    obrigatorio: true,
    status: 'pendente',
  },
  {
    id: 'abert_doc_06',
    titulo: 'DBE (Documento Básico de Entrada) e Capa FCN',
    descricao: 'Transmissão e geração da DBE via Coletor Nacional da Receita Federal.',
    categoria: 'mercantil',
    responsavel: 'contabilidade',
    obrigatorio: true,
    status: 'pendente',
  },
  {
    id: 'abert_doc_07',
    titulo: 'Guia de Taxa da Junta Comercial (DARE) e Comprovante',
    descricao: 'Emissão e quitação da taxa estadual de registro mercantil para protocolo.',
    categoria: 'mercantil',
    responsavel: 'contabilidade',
    obrigatorio: true,
    status: 'pendente',
  },
]

/**
 * Checklist de documentos para o fluxo de MIGRAÇÃO com atribuição explícita de responsabilidade:
 * - "cliente": Documentos a serem solicitados ao cliente / novo titular
 * - "contabilidade": Registros e análises técnicas assumidas pelo escritório
 */
export const CHECKLIST_DOCUMENTOS_MIGRACAO_PADRAO: ItemDocumentoTrilha[] = [
  {
    id: 'migr_doc_01',
    titulo: 'Contrato Social Consolidado & Última Alteração',
    descricao: 'Contrato social registrado na Junta Comercial e todas as alterações em vigor.',
    categoria: 'societario',
    responsavel: 'cliente',
    obrigatorio: true,
    status: 'pendente',
  },
  {
    id: 'migr_doc_02',
    titulo: 'Certificado Digital e-CNPJ A1 (.pfx + senha)',
    descricao:
      'Arquivo do certificado digital válido da empresa com a respectiva senha de instalação.',
    categoria: 'certificados_senhas',
    responsavel: 'cliente',
    obrigatorio: true,
    status: 'pendente',
  },
  {
    id: 'migr_doc_03',
    titulo: 'Procuração Eletrônica e-CAC RFB & Senhas Municipais',
    descricao: 'Outorga da procuração no e-CAC em favor do escritório Rumo e senhas de NF-e.',
    categoria: 'procuracoes',
    responsavel: 'contabilidade',
    obrigatorio: true,
    status: 'pendente',
  },
  {
    id: 'migr_doc_04',
    titulo: 'Último Balanço Patrimonial, DRE & Balancete Analítico',
    descricao:
      'Demonstrativos contábeis assinados pelo contador anterior para implantação de saldos.',
    categoria: 'saldos_contabeis',
    responsavel: 'cliente',
    obrigatorio: true,
    status: 'pendente',
  },
  {
    id: 'migr_doc_05',
    titulo: 'Arquivos SPED (ECD, ECF, EFD Contribuições/ICMS) e DCTFWeb',
    descricao: 'Recibos e arquivos TXT das transmissões do último ano-calendário.',
    categoria: 'arquivos_anteriores',
    responsavel: 'contabilidade',
    obrigatorio: true,
    status: 'pendente',
  },
  {
    id: 'migr_doc_06',
    titulo: 'Termo de Transferência de Responsabilidade Técnica (CFC)',
    descricao: 'Termo formal assinado bilateralmente comunicando a transferência da escrituração.',
    categoria: 'termo_responsabilidade',
    responsavel: 'contabilidade',
    obrigatorio: true,
    status: 'pendente',
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
  // Vínculos de Fluxo Paralelo
  fluxoTipo?: FluxoVinculadoTipo
  fluxoAberturaId?: string
  fluxoMigracaoId?: string
  trilhaDocumentos?: ItemDocumentoTrilha[]
  pedidoDocumentoId?: string
  ellizaProcessoId?: string
}

export const contratosService = {
  // Listar contratos e propostas do escritório
  async list(
    tenantId: string,
    filters?: {
      empresaId?: string
      tipo?: TipoContratoHonorario | 'todos'
      status?: StatusContratoHonorario | 'todos'
      fluxoTipo?: FluxoVinculadoTipo | 'todos'
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
    if (filters?.fluxoTipo && filters.fluxoTipo !== 'todos') {
      parts.push(`fluxo_tipo = "${filters.fluxoTipo}"`)
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().replace(/"/g, '')
      parts.push(`titulo ~ "${q}" || modelo_mensalidade ~ "${q}"`)
    }

    return pb.collection('contratos_honorarios').getFullList<ContratoHonorarioRecord>({
      filter: parts.join(' && '),
      sort: '-created',
      expand: 'empresa,criado_por,fluxo_abertura_id,fluxo_migracao_id,pedido_documento_id',
    })
  },

  // Obter contrato individual por ID
  async getById(id: string): Promise<ContratoHonorarioRecord> {
    return pb.collection('contratos_honorarios').getOne<ContratoHonorarioRecord>(id, {
      expand: 'empresa,criado_por,fluxo_abertura_id,fluxo_migracao_id,pedido_documento_id',
    })
  },

  // Criar novo rascunho de proposta ou contrato com suporte a fluxo vinculado
  async create(input: SalvarContratoInput): Promise<ContratoHonorarioRecord> {
    // Inicializar checklist padrão da trilha de documentos se não fornecido
    let trilhaDocs = input.trilhaDocumentos
    if (!trilhaDocs || trilhaDocs.length === 0) {
      if (input.fluxoTipo === 'abertura') {
        trilhaDocs = CHECKLIST_DOCUMENTOS_ABERTURA_PADRAO
      } else if (input.fluxoTipo === 'migracao_entrada' || input.fluxoTipo === 'migracao_saida') {
        trilhaDocs = CHECKLIST_DOCUMENTOS_MIGRACAO_PADRAO
      } else {
        trilhaDocs = []
      }
    }

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
      fluxo_tipo: input.fluxoTipo || 'nenhum',
      trilha_documentos_json: trilhaDocs,
    }

    if (input.empresaId && input.empresaId !== 'nenhuma') {
      payload.empresa = input.empresaId
    }
    if (input.criadoPor) {
      payload.criado_por = input.criadoPor
    }
    if (input.fluxoAberturaId) {
      payload.fluxo_abertura_id = input.fluxoAberturaId
    }
    if (input.fluxoMigracaoId) {
      payload.fluxo_migracao_id = input.fluxoMigracaoId
    }
    if (input.pedidoDocumentoId) {
      payload.pedido_documento_id = input.pedidoDocumentoId
    }
    if (input.ellizaProcessoId) {
      payload.elliza_processo_id = input.ellizaProcessoId
    }

    const created = await pb
      .collection('contratos_honorarios')
      .create<ContratoHonorarioRecord>(payload, {
        expand: 'empresa,criado_por,fluxo_abertura_id,fluxo_migracao_id,pedido_documento_id',
      })

    // Se vinculado a abertura, atualizar company_onboarding_workflow bidirecionalmente
    if (input.fluxoAberturaId) {
      try {
        await pb.collection('company_onboarding_workflow').update(input.fluxoAberturaId, {
          contrato_honorario_id: created.id,
        })
      } catch (errWf) {
        console.warn('Erro ao vincular contrato em company_onboarding_workflow:', errWf)
      }
    }

    // Se vinculado a migração, atualizar empresas_migracoes_onboarding bidirecionalmente
    if (input.fluxoMigracaoId) {
      try {
        await pb.collection('empresas_migracoes_onboarding').update(input.fluxoMigracaoId, {
          contrato_honorario_id: created.id,
        })
      } catch (errMigr) {
        console.warn('Erro ao vincular contrato em empresas_migracoes_onboarding:', errMigr)
      }
    }

    // Auditoria
    await auditService.log(
      input.tenantId,
      input.criadoPor || '',
      'CRIAR_CONTRATO_HONORARIOS',
      'contratos_honorarios',
      created.id,
      `Criado(a) ${created.tipo.toUpperCase()} "${created.titulo}" no valor de R$ ${created.valor_mensal}. Fluxo vinculado: ${created.fluxo_tipo || 'nenhum'}.`,
    )

    return created
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
    if (input.fluxoTipo !== undefined) payload.fluxo_tipo = input.fluxoTipo
    if (input.fluxoAberturaId !== undefined) {
      payload.fluxo_abertura_id = input.fluxoAberturaId || null
    }
    if (input.fluxoMigracaoId !== undefined) {
      payload.fluxo_migracao_id = input.fluxoMigracaoId || null
    }
    if (input.trilhaDocumentos !== undefined) {
      payload.trilha_documentos_json = input.trilhaDocumentos
    }
    if (input.pedidoDocumentoId !== undefined) {
      payload.pedido_documento_id = input.pedidoDocumentoId || null
    }
    if (input.ellizaProcessoId !== undefined) {
      payload.elliza_processo_id = input.ellizaProcessoId || null
    }

    const updated = await pb
      .collection('contratos_honorarios')
      .update<ContratoHonorarioRecord>(id, payload, {
        expand: 'empresa,criado_por,fluxo_abertura_id,fluxo_migracao_id,pedido_documento_id',
      })

    // Atualização bidirecional em abertura se alterado
    if (input.fluxoAberturaId) {
      try {
        await pb.collection('company_onboarding_workflow').update(input.fluxoAberturaId, {
          contrato_honorario_id: updated.id,
        })
      } catch (errWf) {
        console.warn('Erro ao sincronizar contrato em abertura:', errWf)
      }
    }

    // Atualização bidirecional em migração se alterado
    if (input.fluxoMigracaoId) {
      try {
        await pb.collection('empresas_migracoes_onboarding').update(input.fluxoMigracaoId, {
          contrato_honorario_id: updated.id,
        })
      } catch (errMigr) {
        console.warn('Erro ao sincronizar contrato em migração:', errMigr)
      }
    }

    return updated
  },

  // Atualizar item individual da trilha de documentos do contrato/proposta
  async atualizarItemTrilhaDocumento(params: {
    contratoId: string
    itemId: string
    status: 'pendente' | 'recebido' | 'aprovado' | 'recusado'
    documentoGedId?: string
    nomeArquivo?: string
    observacao?: string
    usuarioId?: string
    tenantId?: string
  }): Promise<ContratoHonorarioRecord> {
    const contrato = await this.getById(params.contratoId)
    const trilha = [...(contrato.trilha_documentos_json || [])]
    const idx = trilha.findIndex((i) => i.id === params.itemId)

    if (idx === -1) {
      throw new Error(`Item de documento ${params.itemId} não encontrado na trilha do contrato.`)
    }

    const agora = new Date().toISOString()
    const itemAntigo = trilha[idx]
    trilha[idx] = {
      ...itemAntigo,
      status: params.status,
      documento_ged_id:
        params.documentoGedId !== undefined ? params.documentoGedId : itemAntigo.documento_ged_id,
      nome_arquivo: params.nomeArquivo !== undefined ? params.nomeArquivo : itemAntigo.nome_arquivo,
      observacao: params.observacao !== undefined ? params.observacao : itemAntigo.observacao,
      recebido_em:
        params.status === 'recebido' || params.status === 'aprovado'
          ? itemAntigo.recebido_em || agora
          : itemAntigo.recebido_em,
      aprovado_em: params.status === 'aprovado' ? agora : itemAntigo.aprovado_em,
    }

    const updated = await pb
      .collection('contratos_honorarios')
      .update<ContratoHonorarioRecord>(
        params.contratoId,
        { trilha_documentos_json: trilha },
        { expand: 'empresa,criado_por,fluxo_abertura_id,fluxo_migracao_id,pedido_documento_id' },
      )

    if (params.tenantId && params.usuarioId) {
      await auditService.log(
        params.tenantId,
        params.usuarioId,
        'ATUALIZAR_ITEM_TRILHA_DOCUMENTOS',
        'contratos_honorarios',
        params.contratoId,
        `Documento "${itemAntigo.titulo}" (${itemAntigo.responsavel.toUpperCase()}) alterado para ${params.status.toUpperCase()}.`,
      )
    }

    return updated
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
      { expand: 'empresa,criado_por,fluxo_abertura_id,fluxo_migracao_id,pedido_documento_id' },
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
      { expand: 'empresa,criado_por,fluxo_abertura_id,fluxo_migracao_id,pedido_documento_id' },
    )
  },

  // Cancelar contrato
  async cancelar(contratoId: string): Promise<ContratoHonorarioRecord> {
    return pb
      .collection('contratos_honorarios')
      .update<ContratoHonorarioRecord>(
        contratoId,
        { status: 'cancelado' },
        { expand: 'empresa,criado_por,fluxo_abertura_id,fluxo_migracao_id,pedido_documento_id' },
      )
  },

  // Excluir rascunho
  async delete(contratoId: string): Promise<boolean> {
    return pb.collection('contratos_honorarios').delete(contratoId)
  },
}

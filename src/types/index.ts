import type { RecordModel } from 'pocketbase'

export type UserRole = 'administrador' | 'contador' | 'auxiliar' | 'consultor' | 'cliente'
export type UserStatus = 'ativo' | 'convite_pendente'

export interface User extends RecordModel {
  name: string
  email: string
  avatar?: string
  email_notificacoes_prazo?: boolean
}

export interface OnboardingChecklistState {
  escritorio_dados?: boolean
  primeira_empresa?: boolean
  plano_contas?: boolean
  primeiro_usuario?: boolean
  convite_portal?: boolean
  ignorado?: boolean
}

export interface Tenant extends RecordModel {
  nome: string
  cnpj?: string
  plano: 'starter' | 'pro' | 'enterprise'
  ativo: boolean
  onboarding_checklist?: OnboardingChecklistState
}

export interface TenantMember extends RecordModel {
  user_id: string
  tenant_id: string
  perfil: UserRole
  status: UserStatus
  expand?: {
    user_id?: User
    tenant_id?: Tenant
  }
}

export type EmpresaRegime = 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | 'mei'
export type EmpresaPorte = 'mei' | 'me' | 'epp' | 'demais'
export type EmpresaStatus = 'ativo' | 'inativo' | 'pendente' | 'encerrado'

export interface Empresa extends RecordModel {
  tenant_id: string
  razao_social: string
  nome_fantasia?: string
  cnpj: string
  inscricao_estadual?: string
  inscricao_municipal?: string
  regime_tributario?: EmpresaRegime
  porte?: EmpresaPorte
  data_abertura?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  pais?: string
  email?: string
  telefone?: string
  site?: string
  observacoes?: string
  status: EmpresaStatus
}

export type DocumentoTipo =
  | 'contrato_social'
  | 'alteracao_contratual'
  | 'fatura'
  | 'nota_fiscal'
  | 'procuracoes'
  | 'relatorios'
  | 'outros'
export type DocumentoStatus = 'pendente' | 'processado' | 'rejeitado'

export interface Documento extends RecordModel {
  tenant_id: string
  empresa_id: string
  nome_arquivo: string
  tipo: DocumentoTipo
  status: DocumentoStatus
  observacoes?: string
  arquivo?: string
  usuario_upload_id: string
  data_upload: string
  expand?: {
    empresa_id?: Empresa
    usuario_upload_id?: User
  }
}

export type WorkflowTipo =
  | 'abertura_empresa'
  | 'alteracao_contratual'
  | 'envio_obrigacao'
  | 'revisao_documento'
  | 'outros'
export type WorkflowPrioridade = 'alta' | 'media' | 'baixa'
export type WorkflowStatus = 'pendente' | 'em_andamento' | 'concluido' | 'cancelado'

export interface Workflow extends RecordModel {
  tenant_id: string
  empresa_id?: string
  tipo: WorkflowTipo
  titulo: string
  descricao?: string
  prioridade: WorkflowPrioridade
  status: WorkflowStatus
  prazo?: string
  atribuido_id?: string
  criado_por_id: string
  expand?: {
    empresa_id?: Empresa
    atribuido_id?: User
    criado_por_id?: User
  }
}

export interface WorkflowActivity extends RecordModel {
  tenant_id: string
  workflow_id: string
  usuario_id: string
  acao: string
  comentario?: string
  data_atividade: string
  expand?: {
    usuario_id?: User
  }
}

export type FiscalTipoObrigacao =
  | 'ecf'
  | 'ecd'
  | 'efd_contribuicoes'
  | 'dctf'
  | 'gia'
  | 'pis_cofins'
  | 'icms'
  | 'iss'
export type FiscalStatus = 'pendente' | 'em_andamento' | 'entregue' | 'aprovado' | 'rejeitado'

export interface FiscalRecord extends RecordModel {
  tenant_id: string
  empresa_id: string
  tipo_obrigacao: FiscalTipoObrigacao
  periodo_apuracao: string
  status: FiscalStatus
  data_entrega?: string
  recibo_arquivo?: string
  observacoes?: string
  responsavel_id?: string
  expand?: {
    empresa_id?: Empresa
    responsavel_id?: User
  }
}

export interface AuditLogRecord extends RecordModel {
  tenant_id: string
  usuario_id?: string
  acao: string
  entidade_tipo: string
  entidade_id: string
  detalhes?: string
  data_evento: string
  expand?: {
    usuario_id?: User
  }
}

export interface AgentConversationRecord extends RecordModel {
  tenant_id: string
  user_id: string
  titulo: string
  resumo?: string
}

export interface AgentMessageRecord extends RecordModel {
  tenant_id: string
  conversation_id: string
  user_id: string
  role: 'user' | 'agent'
  conteudo: string
}

export type ObrigacaoTipo =
  | 'DAS'
  | 'SPED'
  | 'GFIP'
  | 'DIRF'
  | 'EFD'
  | 'DARF'
  | 'FGTS'
  | 'INSS'
  | 'DCTF'
  | 'DMED'
  | 'GIA'
  | 'OUTROS'

export type ObrigacaoStatus = 'pendente' | 'em_andamento' | 'entregue' | 'atrasada' | 'cancelada'

export interface ObrigacaoRecord extends RecordModel {
  tenant_id: string
  empresa_id: string
  tipo: ObrigacaoTipo
  competencia: string
  vencimento: string
  status: ObrigacaoStatus
  responsavel_id?: string
  valor?: number
  observacoes?: string
  anexo?: string
  data_entrega?: string
  exige_certificado?: boolean
  expand?: {
    empresa_id?: Empresa
    responsavel_id?: User
  }
}

// === Módulo Certificado Digital ===
export type TipoCertificadoDigital = 'a1' | 'a3'
export type StatusCertificadoDigital = 'ativo' | 'expirado' | 'revogado'

export interface CertificadoDigitalRecord extends RecordModel {
  tenant_id: string
  empresa: string
  tipo: TipoCertificadoDigital
  titular: string
  numero_serie?: string
  emissor: string
  validade: string
  arquivo_pfx?: string
  senha?: string
  status: StatusCertificadoDigital
  observacoes?: string
  expand?: {
    empresa?: Empresa
  }
}

export type NotificacaoTipo =
  | 'prazo_proximo'
  | 'atrasada'
  | 'workflow_status'
  | 'documento_rejeitado'
  | 'sistema'

export interface NotificacaoRecord extends RecordModel {
  tenant_id: string
  usuario_destino_id?: string
  titulo: string
  mensagem: string
  tipo: NotificacaoTipo
  link?: string
  lida: boolean
}

// === Módulo Contábil (P1) ===
export type ContaTipo = 'ativo' | 'passivo' | 'patrimonio' | 'receita' | 'despesa'

export interface ContaContabil extends RecordModel {
  tenant_id: string
  codigo: string
  nome: string
  tipo: ContaTipo
  nivel: number
  pai?: string
  ativa: boolean
  expand?: {
    pai?: ContaContabil
  }
}

export type LancamentoTipo = 'debito' | 'credito'
export type LancamentoStatus = 'rascunho' | 'confirmado'

export interface LancamentoContabil extends RecordModel {
  tenant_id: string
  empresa: string
  data: string
  tipo: LancamentoTipo
  conta_contabil: string
  contrapartida?: string
  valor: number
  historico: string
  documento?: string
  competencia: string
  status: LancamentoStatus
  lote_id?: string
  criado_por?: string
  expand?: {
    empresa?: Empresa
    conta_contabil?: ContaContabil
    contrapartida?: ContaContabil
    documento?: Documento
    criado_por?: User
  }
}

export interface BalanceteItem {
  id: string
  codigo: string
  nome: string
  tipo: ContaTipo
  nivel: number
  pai?: string
  isSintetica: boolean
  saldoAnterior: number
  debitos: number
  creditos: number
  saldoAtual: number
}

// === Módulo Departamento Pessoal (DP - P1) ===
export type FuncionarioTipo = 'clt' | 'pj' | 'estagio'
export type FuncionarioStatus = 'ativo' | 'demitido' | 'ferias' | 'afastado'

export interface Funcionario extends RecordModel {
  tenant_id: string
  empresa: string
  nome_completo: string
  cpf: string
  cargo: string
  data_admissao: string
  data_demissao?: string
  salario: number
  tipo: FuncionarioTipo
  status: FuncionarioStatus
  centro_custo?: string
  expand?: {
    empresa?: Empresa
  }
}

export interface ItemRubrica {
  descricao: string
  valor: number
}

export type FolhaPagamentoStatus = 'rascunho' | 'processada' | 'paga'

export interface FolhaPagamento extends RecordModel {
  tenant_id: string
  empresa: string
  funcionario: string
  competencia: string
  salario_base: number
  proventos?: ItemRubrica[] | string
  descontos?: ItemRubrica[] | string
  inss: number
  irrf: number
  fgts: number
  total_liquido: number
  status: FolhaPagamentoStatus
  pago_em?: string
  expand?: {
    empresa?: Empresa
    funcionario?: Funcionario
  }
}

export type EventoDpTipo = 'admissao' | 'demissao' | 'ferias' | 'afastado' | 'alteracao_salarial'

export interface EventoDp extends RecordModel {
  tenant_id: string
  empresa: string
  funcionario: string
  tipo: EventoDpTipo
  data_evento: string
  descricao: string
  anexo?: string
  expand?: {
    empresa?: Empresa
    funcionario?: Funcionario
    anexo?: Documento
  }
}

// === Módulo Portal do Cliente ===
export interface PortalAcesso extends RecordModel {
  tenant_id: string
  empresa: string
  email: string
  nome_contato: string
  user?: string
  ativo: boolean
  expand?: {
    empresa?: Empresa
    user?: User
  }
}

// === Módulo Fecho Contábil Automático ===
export type MapeamentoOrigem = 'obrigacao' | 'documento'

export interface MapeamentoContabil extends RecordModel {
  tenant_id: string
  origem: MapeamentoOrigem
  chave: string
  descricao?: string
  conta_debito: string
  conta_credito: string
  expand?: {
    conta_debito?: ContaContabil
    conta_credito?: ContaContabil
  }
}

// === Módulo Patrimônio (P2) ===
export type AtivoCategoria =
  | 'maquinas_equipamentos'
  | 'veiculos'
  | 'moveis_utensilios'
  | 'computadores_ti'
  | 'instalacoes_imoveis'
  | 'outros'

export type AtivoStatus = 'ativo' | 'depreciado' | 'baixado'

export interface AtivoPatrimonial extends RecordModel {
  tenant_id: string
  empresa: string
  descricao: string
  categoria: AtivoCategoria
  numero_nf?: string
  fornecedor?: string
  data_aquisicao: string
  valor_aquisicao: number
  valor_residual: number
  taxa_depreciacao_anual: number
  vida_util_meses?: number
  conta_ativo: string
  conta_depreciacao_acumulada?: string
  conta_despesa_depreciacao?: string
  status: AtivoStatus
  depreciacao_acumulada_calculada?: number
  ultima_competencia_depreciada?: string
  observacoes?: string
  expand?: {
    empresa?: Empresa
    conta_ativo?: ContaContabil
    conta_depreciacao_acumulada?: ContaContabil
    conta_despesa_depreciacao?: ContaContabil
  }
}

export type TipoBaixaAtivo = 'venda' | 'obsolescencia' | 'sucata' | 'perda'

export interface BaixaAtivoRecord extends RecordModel {
  tenant_id: string
  ativo: string
  empresa: string
  tipo_baixa: TipoBaixaAtivo
  data_baixa: string
  valor_venda?: number
  valor_contabil_residual?: number
  ganho_perda?: number
  lote_contabil_id?: string
  motivo?: string
  usuario_id?: string
  expand?: {
    ativo?: AtivoPatrimonial
    empresa?: Empresa
    usuario_id?: User
  }
}

// === Módulo Fecho Mensal ===
export type FechamentoStatus = 'aberto' | 'em_andamento' | 'fechado'

export interface FechamentoCompetenciaRecord extends RecordModel {
  tenant_id: string
  empresa: string
  competencia: string
  status: FechamentoStatus
  data_fechamento?: string
  fechado_por?: string
  observacoes?: string
  reaberto_em?: string
  reaberto_por?: string
  motivo_reabertura?: string
  expand?: {
    empresa?: Empresa
    fechado_por?: User
    reaberto_por?: User
  }
}

export interface FechamentoChecklistItemRecord extends RecordModel {
  tenant_id: string
  fechamento: string
  empresa: string
  competencia: string
  codigo_item: string
  titulo: string
  descricao?: string
  ordem: number
  obrigatorio: boolean
  concluido: boolean
  concluido_em?: string
  responsavel?: string
  status_automatico?: string
  detalhe_automatico?: string
  expand?: {
    fechamento?: FechamentoCompetenciaRecord
    empresa?: Empresa
    responsavel?: User
  }
}

// === Relatórios Contábeis (DRE e Balanço) ===
export interface DRELinha {
  id: string
  codigo: string
  descricao: string
  nivel: number
  tipo: 'grupo' | 'conta' | 'totalizador' | 'resultado'
  valor: number
  destaque?: boolean
  negativo?: boolean
}

export interface BalancoGrupo {
  titulo: string
  tipo: 'ativo' | 'passivo' | 'patrimonio'
  total: number
  subgrupos: {
    nome: string
    codigo: string
    saldo: number
    contas: {
      codigo: string
      nome: string
      saldo: number
    }[]
  }[]
}

// === Módulo Financeiro (P1/P2) ===
export interface ContaBancariaRecord extends RecordModel {
  tenant_id: string
  empresa: string
  banco: string
  agencia: string
  conta: string
  saldo_inicial: number
  saldo_atual?: number
  ativa: boolean
  conta_contabil?: string
  expand?: {
    empresa?: Empresa
    conta_contabil?: ContaContabil
  }
}

export type ContaFinanceiraTipo = 'pagar' | 'receber'
export type ContaFinanceiraStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado'

export interface ContaFinanceiraRecord extends RecordModel {
  tenant_id: string
  empresa: string
  tipo: ContaFinanceiraTipo
  pessoa: string
  descricao: string
  documento_ref?: string
  categoria?: string
  valor: number
  data_emissao: string
  data_vencimento: string
  data_pagamento?: string
  status: ContaFinanceiraStatus
  conta_bancaria?: string
  lote_contabil_id?: string
  observacoes?: string
  expand?: {
    empresa?: Empresa
    categoria?: ContaContabil
    conta_bancaria?: ContaBancariaRecord
  }
}

export type ExtratoTransacaoTipo = 'credito' | 'debito'
export type ExtratoTransacaoStatus = 'pendente' | 'conciliado' | 'ignorado'

export interface ExtratoBancarioRecord extends RecordModel {
  tenant_id: string
  conta_bancaria: string
  empresa: string
  data: string
  descricao: string
  documento_numero?: string
  valor: number
  tipo_transacao: ExtratoTransacaoTipo
  status: ExtratoTransacaoStatus
  titulo_conciliado?: string
  lote_contabil_id?: string
  conciliado_em?: string
  conciliado_por?: string
  expand?: {
    conta_bancaria?: ContaBancariaRecord
    empresa?: Empresa
    titulo_conciliado?: ContaFinanceiraRecord
    conciliado_por?: User
  }
}

// === Integrações Bancárias & Importação Automática ===
export type IntegracaoModo = 'manual' | 'automatico'
export type IntegracaoFrequencia = 'diaria' | 'semanal'
export type IntegracaoFonteTipo = 'email' | 'pasta_sftp' | 'webhook_simulado' | 'arquivo_agendado'
export type IntegracaoStatus = 'ativo' | 'pausado' | 'erro'
export type IntegracaoLogStatus = 'sucesso' | 'aviso' | 'falha'

export interface IntegracaoBancariaRecord extends RecordModel {
  tenant_id: string
  empresa: string
  conta_bancaria: string
  modo: IntegracaoModo
  frequencia: IntegracaoFrequencia
  fonte_tipo: IntegracaoFonteTipo
  fonte_identificador: string
  status: IntegracaoStatus
  ultima_execucao?: string
  proxima_execucao?: string
  total_importados?: number
  total_conciliados?: number
  observacoes?: string
  expand?: {
    empresa?: Empresa
    conta_bancaria?: ContaBancariaRecord
  }
}

export interface IntegracaoLogRecord extends RecordModel {
  tenant_id: string
  integracao: string
  conta_bancaria: string
  data_execucao: string
  status: IntegracaoLogStatus
  linhas_lidas?: number
  linhas_importadas?: number
  linhas_duplicadas?: number
  linhas_conciliadas?: number
  mensagem: string
  detalhes_json?: Record<string, unknown>
  expand?: {
    integracao?: IntegracaoBancariaRecord
    conta_bancaria?: ContaBancariaRecord
  }
}

// === Fluxo de Caixa e DFC ===
export interface FluxoCaixaItemProjecao {
  id: string
  origem: 'realizado' | 'previsto'
  tipo: 'entrada' | 'saida'
  data: string
  descricao: string
  pessoa: string
  documento?: string
  valor: number
  status: string
  empresaNome?: string
  contaBancariaNome?: string
  categoriaNome?: string
}

export interface FluxoCaixaCompetenciaResumo {
  periodoRotulo: string
  dataInicio: string
  dataFim: string
  saldoInicial: number
  entradasRealizadas: number
  entradasPrevistas: number
  totalEntradas: number
  saidasRealizadas: number
  saidasPrevistas: number
  totalSaidas: number
  resultadoPeriodo: number
  saldoFinal: number
  isNegativo: boolean
  itens: FluxoCaixaItemProjecao[]
}

export interface DFCFluxoResultado {
  saldoInicialGeral: number
  saldoFinalProjetado: number
  totalEntradasRealizadas: number
  totalEntradasPrevistas: number
  totalSaidasRealizadas: number
  totalSaidasPrevistas: number
  resultadoLiquidoOperacional: number
  competencias: FluxoCaixaCompetenciaResumo[]
  itensDetalhados: FluxoCaixaItemProjecao[]
}

// === Demonstrativos Prontos para Assinatura (Módulo 1) ===
export type DemonstrativoTipo = 'dre' | 'balanco'
export type DemonstrativoStatus = 'rascunho' | 'enviado' | 'aprovado' | 'reprovado'

export interface DemonstrativoRecord extends RecordModel {
  tenant_id: string
  empresa: string
  competencia: string
  tipo: DemonstrativoTipo
  dados: {
    titulo?: string
    receitaBruta?: number
    deducoes?: number
    receitaLiquida?: number
    custos?: number
    lucroBruto?: number
    despesasOperacionais?: number
    resultadoLiquido?: number
    linhas?: DRELinha[]
    ativoTotal?: number
    passivoTotal?: number
    patrimonioLiquidoTotal?: number
    passivoMaisPL?: number
    equilibrado?: boolean
    diferenca?: number
    ativoCirculante?: BalancoGrupo['subgrupos'][0]
    ativoNaoCirculante?: BalancoGrupo['subgrupos'][0]
    passivoCirculante?: BalancoGrupo['subgrupos'][0]
    patrimonioLiquido?: BalancoGrupo['subgrupos'][0]
    observacoesGerais?: string
  }
  status: DemonstrativoStatus
  data_envio?: string
  data_aprovacao?: string
  observacoes_cliente?: string
  aprovado_por?: string
  gerado_por?: string
  expand?: {
    empresa?: Empresa
    aprovado_por?: User
    gerado_por?: User
  }
}

// === Gestão de Impostos Retidos (Módulo 2) ===
export type ImpostoRetidoTipo = 'darf_inss' | 'darf_irrf' | 'fgts'
export type ImpostoRetidoStatus = 'pendente' | 'pago' | 'atrasado'

export interface ImpostoRetidoRecord extends RecordModel {
  tenant_id: string
  empresa: string
  competencia: string
  tipo: ImpostoRetidoTipo
  valor: number
  vencimento: string
  status: ImpostoRetidoStatus
  vinculo_folha?: string
  vinculo_titulo_financeiro?: string
  lote_contabil?: string
  pago_em?: string
  observacoes?: string
  expand?: {
    empresa?: Empresa
    vinculo_titulo_financeiro?: ContaFinanceiraRecord
  }
}

// === Módulo Pré-Lançamento Inteligente ===
export type PreLancamentoStatus = 'pendente' | 'aceito' | 'rejeitado' | 'convertido'

export interface PreLancamentoRecord extends RecordModel {
  tenant_id: string
  empresa: string
  documento?: string
  competencia: string
  debito_sugerido?: string
  credito_sugerido?: string
  valor_sugerido: number
  historico_sugerido: string
  confianca: number
  status: PreLancamentoStatus
  motivo_rejeicao?: string
  lote_id?: string
  data_processamento?: string
  processado_por?: string
  expand?: {
    empresa?: Empresa
    documento?: Documento
    debito_sugerido?: ContaContabil
    credito_sugerido?: ContaContabil
    processado_por?: User
  }
}

export interface AnalisarDocumentosInput {
  tenantId: string
  empresaId?: string
  competencia?: string
}

export interface AnalisarDocumentosResultado {
  analisados: number
  novasSugestoes: number
  altaConfianca: number
  ignoradosOuExistentes: number
}

// === Módulo Assinaturas Digitais de Demonstrativos (ICP-Brasil / Eletrônica) ===
export type TipoAssinaturaDemonstrativo = 'eletronica_declarada' | 'icp_brasil'
export type TipoCertificadoIcp = 'nenhum' | 'a1' | 'a3'
export type AssinaturaDemonstrativoStatus = 'solicitada' | 'assinada' | 'expirada' | 'cancelada'
export type AssinaturaProvedor = 'interno' | 'd4sign' | 'clicksign' | 'outro'
export type TipoDocumentoAssinatura = 'demonstrativo' | 'contrato_honorarios'

export interface AssinaturaDemonstrativoRecord extends RecordModel {
  tenant_id: string
  demonstrativo?: string
  contrato?: string
  tipo_documento?: TipoDocumentoAssinatura
  empresa?: string
  competencia: string
  tipo_assinatura: TipoAssinaturaDemonstrativo
  tipo_certificado?: TipoCertificadoIcp
  assinante: string
  cargo_cpf: string
  email_assinante?: string
  hash_conteudo: string
  hash_documentacao?: string
  status: AssinaturaDemonstrativoStatus
  token_verificacao: string
  data_solicitacao?: string
  data_assinatura?: string
  dados_certificado?: {
    emissor?: string
    serial?: string
    validade?: string
    titular?: string
    autoridadeCertificadora?: string
  }
  ip_assinatura?: string
  provedor: AssinaturaProvedor
  payload_provedor?: Record<string, unknown>
  expand?: {
    demonstrativo?: DemonstrativoRecord
    contrato?: ContratoHonorarioRecord
    empresa?: Empresa
  }
}

// === Módulo Contratos & Propostas de Honorários ===
export type TipoContratoHonorario = 'proposta' | 'contrato'
export type StatusContratoHonorario = 'rascunho' | 'enviado' | 'assinado' | 'recusado' | 'cancelado'

export interface ClausulaContrato {
  titulo: string
  texto: string
}

export interface DadosCongeladosContrato {
  titulo: string
  tipo: TipoContratoHonorario
  empresa?: {
    id?: string
    razao_social?: string
    nome_fantasia?: string
    cnpj?: string
  }
  escritorio: {
    nome: string
    cnpj: string
    crc: string
  }
  modelo_mensalidade: string
  valor_mensal: number
  dia_vencimento: number
  prazo_contrato: number
  data_inicio?: string
  clausulas: ClausulaContrato[]
  gerado_em: string
}

export interface ContratoHonorarioRecord extends RecordModel {
  tenant_id: string
  empresa?: string
  titulo: string
  tipo: TipoContratoHonorario
  modelo_mensalidade: string
  valor_mensal: number
  dia_vencimento: number
  prazo_contrato: number
  data_inicio?: string
  clausulas: ClausulaContrato[]
  status: StatusContratoHonorario
  dados_congelados?: DadosCongeladosContrato | Record<string, unknown>
  observacoes_recusa?: string
  criado_por?: string
  expand?: {
    empresa?: Empresa
    criado_por?: User
  }
}

// === Monitoramento Trimestral do Ranking Setorial da Reforma Tributária ===
export interface AlertaVariacaoRanking {
  cnpj: string
  razaoSocial: string
  nomeFantasia?: string
  impactoAnteriorReais: number
  impactoNovoReais: number
  diferencaReais: number
  diferencaPercentual: number
  tipoVariacao: 'aumento' | 'reducao'
  causaProvavel: string
}

export interface RankingTrimestralRecord extends RecordModel {
  tenant_id: string
  periodo: string // ex: "2026-T1"
  ano: number
  trimestre: number
  data_execucao?: string
  executado_por_tipo: 'cron_trimestral' | 'manual_usuario'
  executado_por?: string
  total_empresas: number
  total_suficientes?: number
  faturamento_total?: number
  impacto_total_acumulado?: number
  variacao_media_percentual?: number
  resultado_json?: Record<string, unknown>
  alertas_variacao_json?: AlertaVariacaoRanking[]
  versao_normativa?: string
  expand?: {
    executado_por?: User
  }
}

// WhatsApp Web Assistant Types
export type StatusCapturaLead = 'capturado' | 'empresa_criada' | 'empresa_vinculada' | 'descartado'

export interface WhatsAppLeadContatoRecord extends RecordModel {
  tenant_id: string
  empresa_associada?: string
  nome_contato: string
  telefone: string
  origem_chat_jid?: string
  status_captura: StatusCapturaLead
  observacoes?: string
  dados_extras?: Record<string, unknown>
  capturado_por?: string
  expand?: {
    empresa_associada?: Empresa
    capturado_por?: User
  }
}

export type WhatsAppTemplateCategoria =
  | 'cobranca'
  | 'boas_vindas'
  | 'obrigacao_prazo'
  | 'documentos'
  | 'geral'

export interface WhatsAppTemplateRecord extends RecordModel {
  tenant_id: string
  titulo: string
  categoria: WhatsAppTemplateCategoria
  conteudo: string
  ativo: boolean
}

// === Módulo Cadastro Assistido por Documentos ===
export type DocumentoCadastroTipo =
  | 'cartao_cnpj'
  | 'contrato_social'
  | 'ficha_cadastral'
  | 'cpf_socio'
  | 'comprovante_endereco'
  | 'declaracao_ir'
  | 'outro'

export interface SocioExtraido {
  nome: string
  cpf?: string
  qualificacao?: string
  participacao?: string
}

export interface CampoExtraidoItem {
  campo: string
  rotulo: string
  valor: string
  valorOriginal?: string
  origemDoc: string
  confianca: 'alta' | 'media' | 'baixa'
  status: 'aceito' | 'rejeitado' | 'editado'
}

export type AlertaSeveridade = 'bloqueante' | 'inconsistencia' | 'ausencia' | 'atencao'

export interface AlertaValidacao {
  id: string
  severidade: AlertaSeveridade
  categoria: 'inconsistencia' | 'ausencia' | 'atencao'
  campoRelacionado?: string
  titulo: string
  mensagem: string
  sugestao?: string
}

export interface EmpresaCadastroAssistidoRecord extends RecordModel {
  tenant_id: string
  empresa?: string
  arquivo_nome?: string
  arquivo?: string
  tipo_documento?: DocumentoCadastroTipo
  campos_extraidos?: Record<string, unknown>
  alertas?: AlertaValidacao[]
  acoes?: Record<string, unknown>
  criado_por?: string
  expand?: {
    empresa?: Empresa
    criado_por?: User
  }
}

// === Módulo Simulador da Reforma Tributária (IBS/CBS - EC 132/23 e LC 214/25) ===
export interface SimulacaoReformaRecord extends RecordModel {
  tenant_id: string
  empresa?: string
  titulo: string
  razao_social?: string
  cnpj?: string
  regime_atual: 'simples_nacional' | 'lucro_presumido' | 'lucro_real'
  setor_atividade: string
  faturamento_anual: number
  aliquota_atual_estimada: number
  percentual_creditos?: number
  reducao_setorial_60?: boolean
  vende_cesta_basica?: boolean
  inputs_json?: Record<string, unknown>
  resultado_json?: Record<string, unknown>
  compartilhado_portal?: boolean
  criado_por?: string
  expand?: {
    empresa?: Empresa
    criado_por?: User
  }
}

// === Módulo Faturamento Recorrente de Honorários ===
export type StatusFaturamentoRecorrente = 'previsto' | 'faturado' | 'pago' | 'cancelado'

export interface FaturamentoRecorrenteRecord extends RecordModel {
  tenant_id: string
  contrato: string
  empresa: string
  competencia: string // AAAA-MM
  valor: number
  data_vencimento: string
  status: StatusFaturamentoRecorrente
  titulo_financeiro?: string
  motivo_cancelamento?: string
  notas?: string
  criado_por?: string
  expand?: {
    contrato?: ContratoHonorarioRecord
    empresa?: Empresa
    titulo_financeiro?: ContaFinanceiraRecord
    criado_por?: User
  }
}

// === Módulo Parâmetros da Reforma Tributária Versionados ===
export interface ParametrosReformaConfig {
  versaoNormativa: string
  fonte: string
  aliquotaReferenciaPlena: {
    cbs: number
    ibs: number
    total: number
  }
  reducoes: {
    setoresPrioritarios60: number
    profissoesRegulamentadas30: number
    cestaBasicaNacional: number
  }
  simplesNacional: {
    sublimiteTransicional: number
    tetoMaximoSimples: number
    descontoTransicaoSimplesSublimite: number
  }
  calendarioTransicao: {
    ano: number
    descricao: string
    fase: 'teste' | 'cbs_plena' | 'graduacao' | 'pleno'
    aliquotaCBS: number
    aliquotaIBS: number
    fatorTributosAntigos: number
    fatorIBSGraduacao: number
    testeCompensavel?: boolean
  }[]
}

export interface ParametrosReformaRecord extends RecordModel {
  tenant_id: string
  ativo: boolean
  versao: number
  fonte: string
  descricao_alteracao?: string
  parametros_json: ParametrosReformaConfig
  atualizado_por?: string
  expand?: {
    atualizado_por?: User
  }
}

// === Módulo Emissão Inteligente de NFS-e via WhatsApp ===
export type StatusNfseSolicitacao =
  | 'em_analise'
  | 'aprovada'
  | 'emitida'
  | 'rejeitada'
  | 'cancelada'
export type ModoOperacaoNfse = 'simulacao' | 'producao'
export type ModoEmissaoNfse = 'simulacao' | 'nacional_gov' | 'prefeitura_ws'
export type StatusNfseNota = 'emitida' | 'cancelada' | 'substituida'

export interface NfseConfigRecord extends RecordModel {
  tenant_id: string
  empresa_padrao?: string
  webhook_token: string
  evolution_api_url?: string
  evolution_api_key?: string
  evolution_instance?: string
  modo_operacao: ModoOperacaoNfse
  auto_aprovar_alta_confianca: boolean
  msg_saudacao?: string
  msg_recebimento?: string
  msg_aprovacao?: string
  msg_rejeicao?: string
  msg_nota_emitida?: string
  telefone_suporte?: string
  ativo: boolean
  expand?: {
    empresa_padrao?: Empresa
  }
}

export interface NfseAlertaItem {
  campo?: string
  tipo: 'erro_validacao' | 'campo_ausente' | 'inconsistencia' | 'atencao'
  mensagem: string
  severidade: 'bloqueante' | 'atencao' | 'informativo'
}

export interface NfseMensagemHistorico {
  origem: 'cliente' | 'bot' | 'escritorio_bot'
  texto: string
  data: string
}

export interface NfseSolicitacaoRecord extends RecordModel {
  tenant_id: string
  empresa?: string
  contato_nome: string
  contato_telefone: string
  origem_chat_jid?: string
  mensagem_original: string
  mensagem_id_externo?: string
  status: StatusNfseSolicitacao
  score_confianca: number
  tomador_nome?: string
  tomador_documento?: string
  tomador_email?: string
  tomador_endereco?: string
  descricao_servico?: string
  valor_servico?: number
  codigo_servico?: string
  dados_extraidos_json?: Record<string, unknown>
  alertas_json?: NfseAlertaItem[]
  motivo_rejeicao?: string
  revisado_por?: string
  data_revisao?: string
  resposta_enviada_whatsapp: boolean
  historico_mensagens_json?: NfseMensagemHistorico[]
  expand?: {
    empresa?: Empresa
    revisado_por?: User
  }
}

export interface NfseNotaEmitidaRecord extends RecordModel {
  tenant_id: string
  empresa: string
  solicitacao?: string
  numero_nota: number
  serie?: string
  codigo_verificacao: string
  chave_acesso?: string
  data_emissao: string
  competencia: string
  tomador_nome: string
  tomador_documento: string
  tomador_email?: string
  discriminacao_servicos: string
  codigo_servico_municipal?: string
  valor_servicos: number
  valor_deducoes?: number
  valor_pis?: number
  valor_cofins?: number
  valor_inss?: number
  valor_ir?: number
  valor_csll?: number
  valor_iss?: number
  aliquota_iss?: number
  valor_liquido: number
  iss_retido: boolean
  status: StatusNfseNota
  modo_emissao: ModoEmissaoNfse
  certificado_usado?: string
  xml_conteudo?: string
  pdf_html_conteudo?: string
  titulo_financeiro?: string
  whatsapp_destinatario?: string
  whatsapp_enviado_em?: string
  emitido_por?: string
  motivo_cancelamento?: string
  expand?: {
    empresa?: Empresa
    solicitacao?: NfseSolicitacaoRecord
    certificado_usado?: CertificadoDigitalRecord
    titulo_financeiro?: ContaFinanceiraRecord
    emitido_por?: User
  }
}

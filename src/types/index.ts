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
  responsavel_tecnico?: string
  crc_responsavel?: string
  email_contato?: string
  endereco_completo?: string
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

// === Módulo Monitor de Regularidade (Certidões CND/CPEN & E-CAC) ===
export type TipoCertidao =
  | 'receita_pgfn_cnd'
  | 'receita_pgfn_cpen'
  | 'fgts_crf'
  | 'estadual'
  | 'municipal'
  | 'trabalhista_cndt'

export type StatusCertidao = 'valida' | 'pendente_emissao' | 'vencida' | 'positiva_sem_efeito'

export type OrigemCertidao = 'manual' | 'automatica'

export interface CertidaoRecord extends RecordModel {
  tenant_id: string
  empresa: string
  tipo: TipoCertidao
  status: StatusCertidao
  numero_controle?: string
  data_emissao?: string
  data_validade: string
  arquivo_pdf?: string
  origem: OrigemCertidao
  observacoes?: string
  expand?: {
    empresa?: Empresa
  }
}

export type TipoComunicacaoEcac =
  | 'intimacao_fiscal'
  | 'notificacao_lancamento'
  | 'pendencia_cadastral'
  | 'exclusao_simples'
  | 'cobranca_parcelamento'
  | 'aviso_geral'

export type CriticidadeEcac = 'baixa' | 'media' | 'alta'
export type OrigemCapturaEcac = 'manual_supervisionado' | 'automatica_conector'

export interface EcacComunicacaoRecord extends RecordModel {
  tenant_id: string
  empresa: string
  tipo: TipoComunicacaoEcac
  assunto: string
  conteudo?: string
  data_comunicacao: string
  data_limite_resposta?: string
  lida: boolean
  criticidade: CriticidadeEcac
  anexo?: string
  numero_processo?: string
  origem_captura?: OrigemCapturaEcac
  identificador_rfb?: string
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

export type GrauInstrucaoEsocial =
  | 'fundamental_incompleto'
  | 'fundamental_completo'
  | 'medio_incompleto'
  | 'medio_completo'
  | 'superior_incompleto'
  | 'superior_completo'
  | 'pos_graduacao'
  | 'mestrado'
  | 'doutorado'

export type RacaCorEsocial = 'branca' | 'preta' | 'parda' | 'amarela' | 'indigena' | 'nao_informado'

export type EstadoCivilEsocial =
  | 'solteiro'
  | 'casado'
  | 'divorciado'
  | 'viuvo'
  | 'uniao_estavel'
  | 'outro'

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
  // Campos e-Social
  nis_pis?: string
  ctps_numero?: string
  ctps_serie?: string
  ctps_uf?: string
  cbo?: string
  grau_instrucao?: GrauInstrucaoEsocial
  raca_cor?: RacaCorEsocial
  estado_civil?: EstadoCivilEsocial
  sexo?: 'M' | 'F'
  data_nascimento?: string
  nome_mae?: string
  pcd?: boolean
  tipo_deficiencia?: string
  dependentes_irrf?: number
  regime_tributario_trabalhador?: string
  categoria_trabalhador?: string
  matricula_esocial?: string
  expand?: {
    empresa?: Empresa
  }
}

// === e-Social Tipos & Entidades ===
export type EsocialEventoTipo =
  | 'S-1200'
  | 'S-1210'
  | 'S-1298'
  | 'S-1299'
  | 'S-2200'
  | 'S-2205'
  | 'S-2230'
  | 'S-2299'

export type EsocialEventoStatus =
  | 'pendente'
  | 'pronto'
  | 'validado'
  | 'transmitido'
  | 'rejeitado'
  | 'fechado'

export type EsocialAmbiente = 'producao' | 'producao_restrita' | 'homologacao'
export type EsocialLayoutVersao = 'v_s1_0' | 'v_s1_1' | 'v_s1_2'

export interface EsocialErroValidacao {
  campo: string
  mensagem: string
  acao: string
}

export interface EsocialDiagnosticoCredenciais {
  certificado_ok: boolean
  certificado_emissor?: string
  certificado_validade?: string
  certificado_dias_restantes?: number
  senha_ok: boolean
  ambiente_comunicacao: EsocialAmbiente
  transmissor_valido: boolean
  transmissor_cnpj_cpf?: string
  modo_operacao: 'supervisao' | 'producao'
  status_geral: string
  detalhes: {
    item: string
    sucesso: boolean
    mensagem: string
  }[]
}

export interface EsocialConfigRecord extends RecordModel {
  tenant_id: string
  empresa: string
  ambiente: EsocialAmbiente
  certificado_a1?: string
  senha_certificado?: string
  transmissor_cnpj?: string
  transmissor_cpf?: string
  tipo_inscricao?: 'cnpj' | 'cpf'
  versao_layout?: EsocialLayoutVersao
  modo_operacao?: 'supervisao' | 'producao'
  status_conexao?: 'apto' | 'pendente' | 'erro_credenciais'
  auto_gerar_eventos?: boolean
  ultimo_diagnostico_json?: EsocialDiagnosticoCredenciais | Record<string, unknown>
  ultima_verificacao_em?: string
  expand?: {
    empresa?: Empresa
    certificado_a1?: CertificadoDigitalRecord
  }
}

export interface EsocialEventoRecord extends RecordModel {
  tenant_id: string
  empresa: string
  funcionario?: string
  tipo_evento: EsocialEventoTipo
  competencia?: string
  status: EsocialEventoStatus
  identificador_evento?: string
  prazo_legal?: string
  xml_gerado?: string
  erros_validacao?: EsocialErroValidacao[]
  protocolo_envio?: string
  recibo_entrega?: string
  data_transmissao?: string
  duracao_transmissao_ms?: number
  modo_envio?: 'supervisao' | 'producao'
  resposta_governo_json?: Record<string, unknown>
  motivo_reabertura?: string
  justificativa?: string
  expand?: {
    empresa?: Empresa
    funcionario?: Funcionario
  }
}

export interface ItemRubrica {
  descricao: string
  valor: number
  codigo?: string
  rubrica_esocial?: string
  tipo?: 'provento' | 'desconto' | 'informativo'
  quantidade?: number
  unidade?: string
  aliquota_percentual?: number
  referencia?: string
}

export type VerbaTipo = 'provento' | 'desconto'
export type VerbaUnidade = 'horas' | 'dias' | 'valor_fixo' | 'percentual'

export interface VerbaCatalogoRecord extends RecordModel {
  tenant_id: string
  empresa: string
  codigo: string
  descricao: string
  tipo: VerbaTipo
  rubrica_esocial: string
  unidade: VerbaUnidade
  valor_padrao?: number
  incide_inss: boolean
  incide_irrf: boolean
  incide_fgts: boolean
  integra_salario_contrib: boolean
  reflexo_dsr: boolean
  reflexo_ferias_13: boolean
  ativo: boolean
  observacoes?: string
  expand?: {
    empresa?: Empresa
  }
}

export interface AlertaConformidadeClt {
  tipo: 'aviso' | 'infracao' | 'informativo'
  regra: string
  mensagem: string
  sugestao?: string
}

export interface VerbaLancamentoRecord extends RecordModel {
  tenant_id: string
  empresa: string
  funcionario: string
  verba: string
  competencia: string
  quantidade?: number
  aliquota_percentual?: number
  valor_calculado: number
  referencia_detalhe?: string
  alertas_clt?: AlertaConformidadeClt[]
  expand?: {
    empresa?: Empresa
    funcionario?: Funcionario
    verba?: VerbaCatalogoRecord
  }
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
  | 'erro_emissao'
export type ModoOperacaoNfse = 'simulacao' | 'producao'
export type ModoEmissaoNfse = 'simulacao' | 'nacional_gov' | 'prefeitura_ws'
export type StatusNfseNota = 'emitida' | 'cancelada' | 'substituida'

export type ProvedorFiscalTipo = 'governacional' | 'betha' | 'ginfes'
export type ProvedorAmbiente = 'producao' | 'homologacao'

export interface ProvedorEmpresaConfig {
  provedor: ProvedorFiscalTipo
  ambiente?: ProvedorAmbiente
  municipioIbge?: string
  apiUrl?: string
  clientId?: string
  clientSecret?: string
  usuario?: string
  senhaToken?: string
  senha?: string
}

export interface NfseConfigRecord extends RecordModel {
  tenant_id: string
  empresa_padrao?: string
  webhook_token: string
  evolution_api_url?: string
  evolution_api_key?: string
  evolution_instance?: string
  modo_operacao: ModoOperacaoNfse
  auto_aprovar_alta_confianca: boolean
  provedor_fiscal?: ProvedorFiscalTipo
  provedor_ambiente?: ProvedorAmbiente
  govbr_client_id?: string
  govbr_client_secret?: string
  govbr_api_url?: string
  provedor_municipio_ibge?: string
  // Betha Sistemas
  betha_usuario?: string
  betha_senha_token?: string
  betha_api_url?: string
  // Ginfes
  ginfes_usuario?: string
  ginfes_senha?: string
  ginfes_api_url?: string
  // Configurações por Empresa
  provedores_empresas_json?: Record<string, ProvedorEmpresaConfig>
  ultimo_teste_provedor?: {
    sucesso: boolean
    data: string
    mensagem: string
    status_code?: number
    detalhe?: string
  }
  ultimo_teste_evolution?: {
    sucesso: boolean
    data: string
    mensagem: string
    detalhe?: string
  }
  msg_saudacao?: string
  msg_recebimento?: string
  msg_aprovacao?: string
  msg_rejeicao?: string
  msg_nota_emitida?: string
  telefone_suporte?: string
  prazo_dias_cancelamento?: number
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
  ultimo_erro_emissao?: string
  tentativas_emissao?: number
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
  provedor_usado?: string
  url_consulta_nfse?: string
  protocolo_autorizacao?: string
  ged_documento_id?: string
  certificado_usado?: string
  xml_conteudo?: string
  pdf_html_conteudo?: string
  titulo_financeiro?: string
  whatsapp_destinatario?: string
  whatsapp_enviado_em?: string
  emitido_por?: string
  motivo_cancelamento?: string
  codigo_cancelamento?: string
  data_cancelamento?: string
  cancelado_por?: string
  protocolo_cancelamento?: string
  xml_cancelamento?: string
  ged_cancelamento_doc_id?: string
  nota_substituta_id?: string
  nota_substituida_id?: string
  expand?: {
    empresa?: Empresa
    solicitacao?: NfseSolicitacaoRecord
    certificado_usado?: CertificadoDigitalRecord
    titulo_financeiro?: ContaFinanceiraRecord
    emitido_por?: User
    cancelado_por?: User
    ged_cancelamento_doc_id?: Documento
    nota_substituta_id?: NfseNotaEmitidaRecord
    nota_substituida_id?: NfseNotaEmitidaRecord
  }
}

// ==========================================
// CONECTOR RFB (RECEITA FEDERAL / DTE / E-CAC)
// ==========================================

export type RfbAmbiente = 'producao' | 'homologacao'
export type RfbStatusConexao = 'conectado' | 'erro_credenciais' | 'modo_supervisao' | 'desconectado'
export type RfbOrigemAcionamento = 'manual' | 'cron_diario' | 'teste_credenciais'
export type RfbModoOperacao = 'conector_real' | 'modo_supervisao'

export interface RfbDiagnosticoItem {
  item: string
  status: 'ok' | 'erro' | 'alerta'
  detalhe: string
}

export interface RfbDiagnosticoResult {
  sucesso: boolean
  ambiente: RfbAmbiente
  data_verificacao: string
  mensagem: string
  itens: RfbDiagnosticoItem[]
  modo_operacao: RfbModoOperacao
}

export interface RfbConfigRecord {
  id: string
  created: string
  updated: string
  tenant_id: string
  empresa: string
  ativo: boolean
  ambiente: RfbAmbiente
  cnpj_contribuinte?: string
  certificado_a1?: string
  senha_certificado?: string
  contrato_dte_id?: string
  token_ambiente_rfb?: string
  sincronizacao_automatica: boolean
  sincronizar_certidoes: boolean
  sincronizar_ecac: boolean
  ultimo_diagnostico_json?: RfbDiagnosticoResult
  ultima_sincronizacao_em?: string
  status_conexao: RfbStatusConexao
  expand?: {
    empresa?: Empresa
    certificado_a1?: CertificadoDigitalRecord
  }
}

export interface RfbSyncLogRecord {
  id: string
  created: string
  updated: string
  tenant_id: string
  empresa: string
  origem_acionamento: RfbOrigemAcionamento
  sucesso: boolean
  modo_operacao: RfbModoOperacao
  comunicacoes_novas: number
  certidoes_atualizadas: number
  duracao_ms: number
  mensagem: string
  detalhes_json?: Record<string, unknown>
  executado_por?: string
  expand?: {
    empresa?: Empresa
    executado_por?: User
  }
}

export interface RfbSincronizarResult {
  sucesso: boolean
  modo_operacao: RfbModoOperacao
  mensagem: string
  duracao_ms: number
  comunicacoes_novas: number
  certidoes_atualizadas: number
  erros?: string[]
  detalhes?: Record<string, unknown>
}

// === EFD-Reinf & DCTFWeb Types ===
export type ReinfEventoTipo =
  | 'R-1000'
  | 'R-1070'
  | 'R-2010'
  | 'R-2020'
  | 'R-2030'
  | 'R-2040'
  | 'R-2050'
  | 'R-2060'
  | 'R-2098'
  | 'R-2099'
  | 'R-3010'

export type ReinfEventoStatus =
  | 'pendente'
  | 'pronto'
  | 'validado'
  | 'transmitido'
  | 'rejeitado'
  | 'fechado'

export interface ReinfErroValidacao {
  campo: string
  mensagem: string
  acao: string
}

export interface ReinfEventoRecord {
  id: string
  created: string
  updated: string
  tenant_id: string
  empresa: string
  tipo_evento: ReinfEventoTipo
  competencia: string // MM/AAAA
  status: ReinfEventoStatus
  identificador_evento?: string
  prestador_cnpj_cpf?: string
  prestador_razao_social?: string
  numero_documento?: string
  valor_bruto?: number
  base_calculo?: number
  valor_retencao?: number
  codigo_receita?: string
  prazo_legal?: string
  xml_gerado?: string
  erros_validacao?: ReinfErroValidacao[]
  protocolo_envio?: string
  recibo_entrega?: string
  data_transmissao?: string
  duracao_transmissao_ms?: number
  modo_envio?: 'supervisao' | 'producao'
  resposta_governo_json?: Record<string, unknown>
  motivo_reabertura?: string
  justificativa?: string
  titulo_financeiro?: string
  expand?: {
    empresa?: Empresa
    titulo_financeiro?: ContaFinanceiraRecord
  }
}

export type DctfwebTipoDeclaracao = 'geral' | '13_salario' | 'diaria' | 'espetaculo_desportivo'
export type DctfwebStatus = 'pendente' | 'consolidada' | 'transmitida' | 'rejeitada'

export interface DctfwebDebitoItem {
  origem: string // 'e-Social (S-1200/S-1299)' | 'EFD-Reinf (R-2010)' | etc.
  codigo_receita: string // '111-0' | '0561' | '1708' | '5952'
  descricao: string
  base_calculo: number
  aliquota: number
  valor_apurado: number
  deducoes: number
  saldo_pagar: number
}

export interface DctfwebPendenciaBloqueante {
  modulo: string // 'e-Social' | 'EFD-Reinf' | 'Credenciais'
  tipo_evento?: string // 'S-1299' | 'R-2099' | 'S-2200'
  motivo: string
  acao: string
}

export interface DctfwebDeclaracaoRecord {
  id: string
  created: string
  updated: string
  tenant_id: string
  empresa: string
  competencia: string // MM/AAAA
  tipo_declaracao: DctfwebTipoDeclaracao
  status: DctfwebStatus
  debitos_json?: DctfwebDebitoItem[]
  total_debitos?: number
  total_deducoes?: number
  saldo_a_recolher?: number
  esocial_status_fechamento?: 'fechado' | 'pendente' | 'reaberto'
  reinf_status_fechamento?: 'fechado' | 'pendente' | 'reaberto'
  pronta_para_transmitir?: boolean
  pendencias_bloqueantes?: DctfwebPendenciaBloqueante[]
  protocolo_envio?: string
  recibo_entrega?: string
  numero_declaracao?: string
  data_transmissao?: string
  prazo_legal?: string
  modo_envio?: 'supervisao' | 'producao'
  obrigacao_vinculada?: string
  titulo_financeiro?: string
  expand?: {
    empresa?: Empresa
    obrigacao_vinculada?: ObrigacaoRecord
    titulo_financeiro?: ContaFinanceiraRecord
  }
}

// === FÉRIAS & 13º (CLT) & RESCISÕES ===

export type FeriasStatus = 'calculado' | 'aprovado' | 'pago' | 'cancelado'
export type DecimoTerceiroStatus = 'calculado' | 'aprovado' | 'pago' | 'cancelado'
export type DecimoTerceiroParcela = 'primeira_parcela' | 'segunda_parcela' | 'parcela_unica'
export type RescisaoStatus = 'simulada' | 'pendente_aprovacao' | 'concluida' | 'cancelada'
export type RescisaoMotivo =
  | 'sem_justa_causa_empregador'
  | 'justa_causa_empregador'
  | 'pedido_demissao'
  | 'acordo_consensual_art_484_a'
  | 'termino_contrato_experiencia'
  | 'rescisao_indireta'
  | 'aposentadoria'

export type AvisoPrevioTipo = 'trabalhado' | 'indenizado' | 'dispensado' | 'nao_aplicavel'

export interface ItemMapaMedia {
  competencia: string
  verba: string
  codigo?: string
  valor: number
}

export interface FeriasPeriodoRecord {
  id: string
  created: string
  updated: string
  tenant_id: string
  empresa: string
  funcionario: string
  competencia: string
  periodo_aquisitivo_inicio: string
  periodo_aquisitivo_fim: string
  data_inicio_gozo: string
  data_fim_gozo: string
  dias_gozo: number
  vender_abono: boolean
  dias_abono?: number
  adiantar_13: boolean
  salario_base: number
  media_variaveis?: number
  remuneracao_base_ferias: number
  valor_ferias_gozo: number
  terco_constitucional_ferias: number
  valor_abono_pecuniario?: number
  terco_constitucional_abono?: number
  total_bruto: number
  base_inss?: number
  inss?: number
  base_irrf?: number
  irrf?: number
  total_descontos?: number
  total_liquido: number
  data_limite_pagamento?: string
  mapa_medias_json?: ItemMapaMedia[]
  status: FeriasStatus
  integrado_folha?: boolean
  pago_em?: string
  observacoes?: string
  expand?: {
    empresa?: Empresa
    funcionario?: Funcionario
  }
}

export interface DecimoTerceiroRecord {
  id: string
  created: string
  updated: string
  tenant_id: string
  empresa: string
  funcionario: string
  ano: number
  competencia: string
  parcela: DecimoTerceiroParcela
  meses_trabalhados: number
  salario_base: number
  media_variaveis?: number
  salario_maternidade_abatimento?: number
  remuneracao_base_calculo: number
  valor_bruto: number
  adiantamento_pago?: number
  base_inss?: number
  inss?: number
  base_irrf?: number
  irrf?: number
  fgts?: number
  total_descontos?: number
  total_liquido: number
  mapa_medias_json?: ItemMapaMedia[]
  codigo_receita_inss?: string
  vencimento_guia_inss?: string
  status: DecimoTerceiroStatus
  integrado_folha?: boolean
  pago_em?: string
  observacoes?: string
  expand?: {
    empresa?: Empresa
    funcionario?: Funcionario
  }
}

export interface ItemVerbaRescisoria {
  rubrica?: string
  descricao: string
  tipo: 'provento' | 'desconto'
  valor: number
  referencia?: string
}

export interface RescisaoRecord {
  id: string
  created: string
  updated: string
  tenant_id: string
  empresa: string
  funcionario: string
  motivo_desligamento: RescisaoMotivo
  codigo_afastamento_esocial: string
  data_aviso_previo?: string
  tipo_aviso_previo: AvisoPrevioTipo
  dias_aviso_previo: number
  data_desligamento: string
  data_projecao_aviso?: string
  dias_saldo_salario: number
  salario_base: number
  media_variaveis?: number
  saldo_salario_valor: number
  aviso_previo_indenizado_valor?: number
  decimo_terceiro_proporcional_valor: number
  decimo_terceiro_indenizado_aviso?: number
  ferias_vencidas_valor?: number
  terco_ferias_vencidas?: number
  ferias_proporcionais_valor: number
  terco_ferias_proporcionais: number
  ferias_indenizadas_aviso?: number
  salario_familia_proporcional?: number
  outros_proventos?: number
  total_bruto_rescisao: number
  desconto_inss?: number
  desconto_irrf?: number
  desconto_aviso_previo_nao_cumprido?: number
  desconto_adiantamento?: number
  outros_descontos?: number
  total_descontos_rescisao: number
  total_liquido_rescisao: number
  saldo_fgts_para_fins_rescisorios?: number
  aliquota_multa_fgts?: number
  valor_multa_rescisoria_fgts?: number
  saque_fgts_autorizado?: boolean
  codigo_saque_fgts?: string
  prazo_pagamento_limite: string
  alertas_conformidade_clt?: AlertaConformidadeClt[]
  mapa_medias_json?: ItemMapaMedia[]
  verbas_rescisorias_detalhadas?: ItemVerbaRescisoria[]
  status: RescisaoStatus
  evento_s2299_gerado_id?: string
  chave_conectividade_emitida?: boolean
  concluido_em?: string
  concluido_por?: string
  observacoes?: string
  expand?: {
    empresa?: Empresa
    funcionario?: Funcionario
    concluido_por?: User
  }
}

// === BENEFÍCIOS (VT / VA / VR) ===
export type BeneficioTipo = 'vale_transporte' | 'vale_alimentacao' | 'vale_refeicao'
export type BeneficioStatus = 'pendente' | 'entregue' | 'cancelado'

export interface BeneficioConcedidoRecord {
  id: string
  created: string
  updated: string
  tenant_id: string
  empresa: string
  funcionario: string
  competencia: string // MM/AAAA
  tipo: BeneficioTipo
  dias_uteis?: number
  quantidade_dia?: number
  valor_unitario?: number
  valor_total_beneficio: number
  desconto_colaborador?: number
  custo_empresa?: number
  operadora?: string
  numero_cartao?: string
  status: BeneficioStatus
  data_entrega?: string
  observacoes?: string
  expand?: {
    empresa?: Empresa
    funcionario?: Funcionario
  }
}

// === CONVENÇÕES COLETIVAS & REAJUSTES ===
export type ConvencaoStatusVigencia =
  | 'vigente'
  | 'a_vencer_60'
  | 'a_vencer_30'
  | 'a_vencer_7'
  | 'vencida'
  | 'em_negociacao'

export interface ParametroAdicionalConvencao {
  nome: string
  valor: number
  tipo: 'valor_fixo' | 'percentual' | 'dias' | 'texto'
  unidade?: string
}

export interface ConvencaoColetivaRecord {
  id: string
  created: string
  updated: string
  tenant_id: string
  empresa: string
  titulo: string
  sindicato_laboral: string
  sindicato_patronal?: string
  categoria_profissional: string
  numero_registro_mte?: string
  data_base: string
  vigencia_inicio: string
  vigencia_fim: string
  arquivo_pdf?: string
  piso_salarial?: number
  percentual_reajuste?: number
  data_aplicacao_reajuste?: string
  adicional_hora_extra?: number
  adicional_noturno?: number
  adicional_insalubridade_minimo?: number
  ticket_refeicao_diario?: number
  auxilio_creche?: number
  parametros_adicionais_json?: ParametroAdicionalConvencao[]
  status_vigencia: ConvencaoStatusVigencia
  alerta_dias_config?: number
  ultima_aplicacao_em?: string
  observacoes?: string
  expand?: {
    empresa?: Empresa
  }
}

export type HistoricoSalarialMotivo =
  | 'reajuste_convencao_coletiva'
  | 'promocao'
  | 'merito'
  | 'enquadramento_piso'
  | 'reversao_rollback'

export interface HistoricoSalarialRecord {
  id: string
  created: string
  updated: string
  tenant_id: string
  empresa: string
  funcionario: string
  convencao_origem?: string
  data_alteracao: string
  competencia_vigencia: string
  motivo: HistoricoSalarialMotivo
  salario_anterior: number
  salario_novo: number
  percentual_aplicado?: number
  diferenca_mensal?: number
  retroativo_sugerido?: number
  meses_retroativos?: number
  lote_reajuste_id?: string
  revertido?: boolean
  data_reversao?: string
  detalhes_json?: Record<string, unknown>
  expand?: {
    empresa?: Empresa
    funcionario?: Funcionario
    convencao_origem?: ConvencaoColetivaRecord
  }
}

// === GUIAS & PAGAMENTOS (PAR / PER-DCOMP) ===

export type GuiaTipo = 'darf' | 'darf_previdenciario' | 'dae_par' | 'dctfweb' | 'das' | 'perdcomp'

export type GuiaSituacao = 'pendente' | 'paga' | 'vencida' | 'em_parcelamento' | 'compensada'

export type GuiaOrigem = 'manual' | 'dctfweb' | 'fiscal' | 'conector_rfb' | 'perdcomp'

export interface GuiaPagamentoRecord {
  id: string
  created: string
  updated: string
  tenant_id: string
  empresa: string
  tipo_guia: GuiaTipo
  codigo_receita: string
  periodo_apuracao: string
  numero_referencia?: string
  descricao?: string
  valor_original?: number
  acrescimos?: number
  valor_total: number
  data_vencimento: string
  data_pagamento?: string
  situacao: GuiaSituacao
  comprovante_arquivo?: string
  origem: GuiaOrigem
  titulo_financeiro?: string
  autenticacao_bancaria?: string
  observacoes?: string
  criado_por?: string
  expand?: {
    empresa?: Empresa
    titulo_financeiro?: ContaFinanceiraRecord
    criado_por?: User
  }
}

export type ModalidadeParcelamento =
  | 'pert_sn'
  | 'pert_demais'
  | 'ordinario_rfb'
  | 'simplificado_previdenciario'
  | 'transacao_tributaria_pgfn'
  | 'perdcomp_compensacao'
  | 'outros'

export type SituacaoParcelamentoRfb =
  | 'em_dia'
  | 'parcela_a_vencer'
  | 'em_atraso'
  | 'liquidado'
  | 'rescindido'

export type ParcelaStatus = 'paga' | 'aberta' | 'atrasada'

export interface ParcelaItem {
  numero: number
  vencimento: string
  valor_principal: number
  juros_selic?: number
  valor_total: number
  status: ParcelaStatus
  data_pagamento?: string | null
  codigo_barras?: string
  observacoes?: string
}

export interface ParcelamentoFederalRecord {
  id: string
  created: string
  updated: string
  tenant_id: string
  empresa: string
  numero_parcelamento: string
  modalidade: ModalidadeParcelamento
  descricao_modalidade?: string
  data_adesao: string
  total_parcelas: number
  parcelas_quitadas: number
  valor_total_consolidado?: number
  saldo_devedor: number
  situacao_rfb: SituacaoParcelamentoRfb
  proxima_parcela_numero?: number
  proxima_parcela_vencimento?: string
  proxima_parcela_valor?: number
  quadro_parcelas_json?: ParcelaItem[]
  origem_captura: 'manual_contador' | 'conector_rfb_dte'
  observacoes?: string
  criado_por?: string
  expand?: {
    empresa?: Empresa
    criado_por?: User
  }
}

export type SaudeParcelamentoBadge = 'adimplente' | 'vencendo_7d' | 'inadimplente'

export interface ResumoGuiasPagamentosEmpresa {
  totalAberto: number
  totalPagoAno: number
  totalVencido: number
  qtdGuiasVencidas: number
  qtdGuiasAbertas: number
  qtdGuiasPagas: number
  parcelamentosAtivos: number
  saldoDevedorParcelamentos: number
  parcelamentosComAtraso: number
  parcelamentosVencendo7d: number
  regularidadeTributaria: 'regular' | 'alerta' | 'irregular'
}

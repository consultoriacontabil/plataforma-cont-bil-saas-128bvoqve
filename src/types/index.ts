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
  expand?: {
    empresa_id?: Empresa
    responsavel_id?: User
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

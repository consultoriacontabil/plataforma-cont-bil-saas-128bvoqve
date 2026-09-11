import type { RecordModel } from 'pocketbase'

export type UserRole = 'administrador' | 'contador' | 'auxiliar' | 'consultor'
export type UserStatus = 'ativo' | 'convite_pendente'

export interface User extends RecordModel {
  name: string
  email: string
  avatar?: string
  email_notificacoes_prazo?: boolean
}

export interface Tenant extends RecordModel {
  nome: string
  cnpj?: string
  plano: 'starter' | 'pro' | 'enterprise'
  ativo: boolean
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

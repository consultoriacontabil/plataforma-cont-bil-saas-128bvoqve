import type { RecordModel } from 'pocketbase'

export type UserRole = 'administrador' | 'contador' | 'auxiliar' | 'consultor'
export type UserStatus = 'ativo' | 'convite_pendente'

export interface User extends RecordModel {
  name: string
  email: string
  avatar?: string
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

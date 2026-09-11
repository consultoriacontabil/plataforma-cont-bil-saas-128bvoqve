import type { Empresa, CertificadoDigitalRecord } from '@/types'

/**
 * Dados de entrada para o Adapter de Emissão Fiscal de NFS-e
 */
export interface NfseEmissaoPayload {
  numero: number
  serie?: string
  competencia: string
  dataEmissao: string
  prestador: {
    cnpj: string
    razaoSocial: string
    nomeFantasia?: string
    inscricaoMunicipal?: string
    logradouro?: string
    numero?: string
    bairro?: string
    cidade?: string
    uf?: string
    cep?: string
    codigoIbge?: string
    telefone?: string
    email?: string
  }
  tomador: {
    documento: string
    nome: string
    email?: string
    endereco?: string
  }
  servico: {
    codigo: string
    discriminacao: string
    valorServicos: number
    valorIss: number
    aliquotaIss: number
    issRetido: boolean
    valorLiquido: number
    valorPis?: number
    valorCofins?: number
    valorIr?: number
    valorCsll?: number
  }
  ambiente: 'producao' | 'homologacao'
  certificado?: CertificadoDigitalRecord
  credenciais?: {
    clientId?: string
    clientSecret?: string
    apiUrl?: string
    municipioIbge?: string
    // Credenciais Betha
    usuario?: string
    senhaToken?: string
    // Credenciais Ginfes
    senha?: string
  }
}

/**
 * Resposta padronizada do Adapter Fiscal
 */
export interface NfseEmissaoResult {
  sucesso: boolean
  modo: 'governacional_real' | 'simulacao' | 'betha_real' | 'ginfes_real'
  numeroNota: number
  codigoVerificacao: string
  chaveAcesso?: string
  protocoloAutorizacao?: string
  urlConsulta: string
  xmlAssinado: string
  mensagemRetorno: string
  rawResponse?: unknown
  erroRejeicao?: {
    codigo: string
    mensagem: string
    correcaoSugerida?: string
  }
}

/**
 * Motivo oficial de cancelamento (ABRASF e Gov.br)
 */
export interface CodigoCancelamentoItem {
  codigo: string
  descricao: string
  detalhe?: string
  permiteSubstituicao?: boolean
}

/**
 * Tabela oficial de motivos de cancelamento ABRASF / Gov.br
 */
export const CODIGOS_CANCELAMENTO_OFICIAIS: CodigoCancelamentoItem[] = [
  {
    codigo: '1',
    descricao: 'Erro na emissão',
    detalhe: 'Dados incorretos de tomador, valores, alíquota ou retenção.',
    permiteSubstituicao: true,
  },
  {
    codigo: '2',
    descricao: 'Serviço não prestado',
    detalhe: 'Contrato cancelado ou serviço não executado pelo prestador.',
    permiteSubstituicao: false,
  },
  {
    codigo: '3',
    descricao: 'Erro de assinatura',
    detalhe: 'Inconsistência de certificado digital ou assinatura eletrônica do RPS.',
    permiteSubstituicao: true,
  },
  {
    codigo: '4',
    descricao: 'Duplicidade da nota',
    detalhe: 'Emissão repetida para o mesmo fato gerador e tomador.',
    permiteSubstituicao: false,
  },
  {
    codigo: '5',
    descricao: 'Erro de processamento',
    detalhe: 'Falha ou rejeição no processamento pelo fisco municipal/nacional.',
    permiteSubstituicao: true,
  },
  {
    codigo: '9',
    descricao: 'Outros motivos',
    detalhe: 'Justificativa administrativa fundamentada pela contabilidade.',
    permiteSubstituicao: false,
  },
]

/**
 * Payload de entrada para Cancelamento de NFS-e no Provedor Fiscal
 */
export interface NfseCancelamentoPayload {
  numeroNota: number
  codigoVerificacao: string
  chaveAcesso?: string
  cnpjPrestador: string
  inscricaoMunicipal?: string
  codigoIbge?: string
  codigoCancelamento: string // '1', '2', '3', '4', '5', '9'
  motivo: string
  ambiente: 'producao' | 'homologacao'
  certificado?: CertificadoDigitalRecord
  credenciais?: {
    clientId?: string
    clientSecret?: string
    apiUrl?: string
    municipioIbge?: string
    usuario?: string
    senhaToken?: string
    senha?: string
  }
}

/**
 * Resposta padronizada do Cancelamento Fiscal
 */
export interface NfseCancelamentoResult {
  sucesso: boolean
  modo: 'governacional_real' | 'simulacao' | 'betha_real' | 'ginfes_real'
  numeroNota: number
  codigoVerificacao: string
  protocoloCancelamento?: string
  dataHoraCancelamento: string
  xmlCancelamento: string
  mensagemRetorno: string
  rawResponse?: unknown
  erroRejeicao?: {
    codigo: string
    mensagem: string
    correcaoSugerida?: string
  }
}

/**
 * Interface do Adapter Fiscal para conformidade com provedores municipais e nacionais
 */
export interface NfseFiscalAdapter {
  id: 'governacional' | 'betha' | 'ginfes'
  nome: string
  statusDisponibilidade: 'ativo' | 'em_breve'
  descricao: string

  /**
   * Valida as credenciais e certificado contra o provedor (Handshake / Consulta de Status)
   */
  testarConexao(params: {
    apiUrl?: string
    clientId?: string
    clientSecret?: string
    usuario?: string
    senhaToken?: string
    senha?: string
    municipioIbge?: string
    empresaId?: string
    tenantId?: string
    certificado?: CertificadoDigitalRecord
    ambiente?: 'producao' | 'homologacao'
  }): Promise<{
    sucesso: boolean
    mensagem: string
    statusCode?: number
    detalhe?: string
  }>

  /**
   * Transmite a NFS-e e retorna os dados oficiais da emissão
   */
  emitir(payload: NfseEmissaoPayload): Promise<NfseEmissaoResult>

  /**
   * Transmite evento de cancelamento da NFS-e ao provedor fiscal
   */
  cancelar(payload: NfseCancelamentoPayload): Promise<NfseCancelamentoResult>
}

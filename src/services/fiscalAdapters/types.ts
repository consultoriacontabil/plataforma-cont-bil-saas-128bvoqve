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
}

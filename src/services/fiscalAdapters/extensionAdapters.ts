import type { NfseFiscalAdapter, NfseEmissaoPayload, NfseEmissaoResult } from './types'

/**
 * Adapter para o provedor municipal Betha Sistemas
 * Ponto de extensão preparado para conexão futura sem reescrita
 */
export class BethaFiscalAdapter implements NfseFiscalAdapter {
  id = 'betha' as const
  nome = 'Betha Sistemas (Municipal)'
  statusDisponibilidade = 'em_breve' as const
  descricao =
    'Provedor municipal Betha Sistemas (layout ABRASF v2.02). Requer credenciais municipais próprias e usuário/senha do portal Betha.'

  async testarConexao(): Promise<{
    sucesso: boolean
    mensagem: string
    statusCode?: number
    detalhe?: string
  }> {
    return {
      sucesso: false,
      mensagem:
        'O provedor Betha Sistemas está disponível como ponto de extensão na arquitetura. Para ativação direta, informe as credenciais municipais de acesso ao Webservice da sua prefeitura.',
      detalhe: 'Suporte a emissão em lote e síncrona nos municípios cobertos pela Betha.',
    }
  }

  async emitir(payload: NfseEmissaoPayload): Promise<NfseEmissaoResult> {
    return {
      sucesso: false,
      modo: 'betha_real',
      numeroNota: payload.numero,
      codigoVerificacao: '',
      urlConsulta: '',
      xmlAssinado: '',
      mensagemRetorno:
        'Provedor Betha Sistemas requer credenciais municipais e certificado instalado no servidor da prefeitura.',
      erroRejeicao: {
        codigo: 'PROVEDOR_EM_BREVE',
        mensagem: 'Provedor Betha requer parametrização de credenciais próprias do município.',
        correcaoSugerida:
          'Utilize o Emissor Nacional Gov.br como provedor ativo ou configure a emissão via Simulação Controlada.',
      },
    }
  }
}

/**
 * Adapter para o provedor municipal Ginfes
 * Ponto de extensão preparado para conexão futura sem reescrita
 */
export class GinfesFiscalAdapter implements NfseFiscalAdapter {
  id = 'ginfes' as const
  nome = 'Ginfes (Municipal ABRASF)'
  statusDisponibilidade = 'em_breve' as const
  descricao =
    'Provedor Ginfes (layout ABRASF v1.0 / v2.0). Requer certificado e-CNPJ A1 e credenciais do emissor municipal.'

  async testarConexao(): Promise<{
    sucesso: boolean
    mensagem: string
    statusCode?: number
    detalhe?: string
  }> {
    return {
      sucesso: false,
      mensagem:
        'O provedor Ginfes está disponível como ponto de extensão na arquitetura. Requer assinatura XML com certificado A1 e envio via SOAP/XML.',
      detalhe: 'Atualmente o provedor ativo de produção é o Emissor Nacional (Gov.br).',
    }
  }

  async emitir(payload: NfseEmissaoPayload): Promise<NfseEmissaoResult> {
    return {
      sucesso: false,
      modo: 'ginfes_real',
      numeroNota: payload.numero,
      codigoVerificacao: '',
      urlConsulta: '',
      xmlAssinado: '',
      mensagemRetorno: 'Provedor Ginfes requer certificado e credenciais municipais SOAP.',
      erroRejeicao: {
        codigo: 'PROVEDOR_EM_BREVE',
        mensagem: 'Provedor Ginfes em fase de extensão na arquitetura.',
        correcaoSugerida:
          'Alterne para o provedor Gov.br (Emissor Nacional) na aba de Configuração.',
      },
    }
  }
}

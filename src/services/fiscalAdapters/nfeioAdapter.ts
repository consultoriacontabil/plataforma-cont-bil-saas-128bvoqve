import type {
  NfseFiscalAdapter,
  NfseEmissaoPayload,
  NfseEmissaoResult,
  NfseCancelamentoPayload,
  NfseCancelamentoResult,
} from './types'
import pb from '@/lib/pocketbase/client'

/**
 * Adapter oficial para emissão de NFS-e via provedor NFE.io
 * API REST v1: https://api.nfe.io/v1
 */
export class NfeIoFiscalAdapter implements NfseFiscalAdapter {
  id = 'nfeio' as const
  nome = 'NFE.io (Plataforma Fiscal em Nuvem)'
  statusDisponibilidade = 'ativo' as const
  descricao =
    'Integração direta com a API da NFE.io. Emite notas de serviço em mais de 1.500 municípios homologados com webhooks assíncronos.'

  private defaultBaseUrl = 'https://api.nfe.io'

  /**
   * Teste de Conexão Real:
   * GET https://api.nfe.io/v1/companies com Authorization: <chave>
   * 200 -> "Conectada" (com listagem das empresas encontradas)
   * 401 -> "Chave incorreta"
   * Timeout/DNS -> "URL inalcançável"
   * NUNCA simula sucesso.
   */
  async testarConexao(params: {
    apiUrl?: string
    apiKey?: string
    companyId?: string
    empresaId?: string
    tenantId?: string
    ambiente?: 'producao' | 'homologacao'
  }): Promise<{
    sucesso: boolean
    mensagem: string
    statusCode?: number
    detalhe?: string
  }> {
    const apiKey = params.apiKey?.trim()
    const companyId = params.companyId?.trim()

    if (!apiKey) {
      return {
        sucesso: false,
        mensagem:
          'Chave de API da NFE.io ausente. Informe a chave privada gerada no painel da NFE.io.',
        detalhe: 'Acesse https://app.nfe.io > Conta > Chaves de Acesso para obter sua API Key.',
      }
    }

    try {
      const resp = await pb.send<{
        sucesso: boolean
        mensagem: string
        status_code?: number
        detalhe?: string
      }>('/backend/v1/nfse/testar-provedor', {
        method: 'POST',
        body: {
          tenant_id: params.tenantId || pb.authStore.record?.id,
          provedor: 'nfeio',
          api_key: apiKey,
          company_id: companyId,
          empresa_id: params.empresaId,
        },
      })

      return {
        sucesso: resp.sucesso,
        mensagem: resp.mensagem,
        statusCode: resp.status_code,
        detalhe: resp.detalhe,
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      return {
        sucesso: false,
        mensagem: 'Falha ao conectar com o backend de validação NFE.io: ' + errMsg,
        detalhe: 'Verifique a conectividade de rede com o serviço.',
      }
    }
  }

  /**
   * Emissão via NFE.io:
   * POST https://api.nfe.io/v1/companies/{companyId}/serviceinvoices
   * Payload: {
   *   borrower: { type, name, federalTaxNumber, email, address },
   *   cityServiceCode,
   *   description,
   *   servicesAmount
   * }
   * Se faltar apiKey ou companyId -> status aguardando_credenciais (Modo Supervisão)
   */
  async emitir(payload: NfseEmissaoPayload): Promise<NfseEmissaoResult> {
    const cred = payload.credenciais
    const apiKey = cred?.nfeioApiKey?.trim()
    const companyId = cred?.nfeioCompanyId?.trim()

    // Sem chave ou sem companyId -> Retido em Modo Supervisão
    if (!apiKey || !companyId) {
      return {
        sucesso: false,
        modo: 'aguardando_credenciais',
        numeroNota: payload.numero,
        codigoVerificacao: '',
        urlConsulta: '',
        xmlAssinado: '',
        mensagemRetorno:
          'Emissão retida em Modo Supervisão: Credenciais NFE.io ausentes (Chave de API ou ID da Empresa não configurados).',
        erroRejeicao: {
          codigo: 'CREDENCIAIS_AUSENTES',
          mensagem:
            'A empresa prestadora necessita de Chave de API e Company ID cadastrados na aba Configuração NFS-e & WhatsApp.',
          correcaoSugerida:
            'Acesse Configurações > Provedores Fiscais > NFE.io e insira a API Key e Company ID da empresa.',
        },
      }
    }

    const cleanTaxNumber = payload.tomador.documento.replace(/\D/g, '')
    const borrowerType = cleanTaxNumber.length === 11 ? 'NaturalPerson' : 'LegalEntity'

    const bodyNfeIo = {
      cityServiceCode: payload.servico.codigo || '01.07',
      description: payload.servico.discriminacao,
      servicesAmount: payload.servico.valorServicos,
      borrower: {
        type: borrowerType,
        name: payload.tomador.nome,
        federalTaxNumber: cleanTaxNumber,
        email: payload.tomador.email || undefined,
        address: payload.tomador.endereco
          ? {
              street: payload.tomador.endereco,
            }
          : undefined,
      },
    }

    try {
      const endpoint = `${this.defaultBaseUrl}/v1/companies/${encodeURIComponent(companyId)}/serviceinvoices`

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: apiKey,
        },
        body: JSON.stringify(bodyNfeIo),
      })

      if (resp.ok) {
        const dados = await resp.json()
        const numeroNota = Number(dados.number || payload.numero)
        const codVerif = String(dados.checkCode || dados.id || `${payload.numero}-NFEIO`)
        const chaveAcesso = String(dados.id || dados.flowId || payload.numero)
        const urlConsulta =
          dados.uri || `https://api.nfe.io/v1/companies/${companyId}/serviceinvoices/${dados.id}`

        return {
          sucesso: true,
          modo: 'nfeio_real',
          numeroNota,
          codigoVerificacao: codVerif,
          chaveAcesso,
          protocoloAutorizacao: String(dados.id || `NFEIO-${Date.now()}`),
          urlConsulta,
          xmlAssinado: dados.xml || '',
          mensagemRetorno:
            'NFS-e enviada para processamento com sucesso na NFE.io! O webhook notificará o status final.',
          rawResponse: dados,
        }
      } else {
        const rawText = await resp.text()
        let parsed: Record<string, unknown> = {}
        try {
          parsed = JSON.parse(rawText)
        } catch {
          /* intentionally ignored */
        }

        const statusHttp = resp.status
        let motivo = (parsed.message as string) || (parsed.error as string) || rawText.slice(0, 300)

        if (statusHttp === 401) {
          motivo = 'Chave incorreta da NFE.io (HTTP 401 Unauthorized).'
        } else if (statusHttp === 404) {
          motivo = `Empresa NFE.io não encontrada com o ID informado: ${companyId} (HTTP 404).`
        }

        return {
          sucesso: false,
          modo: 'nfeio_real',
          numeroNota: payload.numero,
          codigoVerificacao: '',
          urlConsulta: '',
          xmlAssinado: '',
          mensagemRetorno: motivo,
          rawResponse: parsed,
          erroRejeicao: {
            codigo: String(statusHttp),
            mensagem: motivo,
            correcaoSugerida:
              statusHttp === 401
                ? 'Verifique se a Chave de API da NFE.io é válida.'
                : statusHttp === 404
                  ? 'Verifique se o Company ID corresponde à empresa cadastrada na NFE.io.'
                  : 'Consulte os dados do tomador e código LC 116 e tente novamente.',
          },
        }
      }
    } catch (errRede: unknown) {
      const errMsg = errRede instanceof Error ? errRede.message : String(errRede)
      return {
        sucesso: false,
        modo: 'nfeio_real',
        numeroNota: payload.numero,
        codigoVerificacao: '',
        urlConsulta: '',
        xmlAssinado: '',
        mensagemRetorno: `Falha de rede ao conectar à NFE.io: ${errMsg}`,
        erroRejeicao: {
          codigo: 'NETWORK_ERROR',
          mensagem: errMsg,
          correcaoSugerida:
            'A URL da API da NFE.io está inalcançável ou o servidor teve timeout de conexão.',
        },
      }
    }
  }

  /**
   * Cancelamento via NFE.io:
   * DELETE https://api.nfe.io/v1/companies/{companyId}/serviceinvoices/{invoiceId}
   */
  async cancelar(payload: NfseCancelamentoPayload): Promise<NfseCancelamentoResult> {
    const cred = payload.credenciais
    const apiKey = cred?.nfeioApiKey?.trim()
    const companyId = cred?.nfeioCompanyId?.trim()
    const invoiceId = payload.chaveAcesso || String(payload.numeroNota)
    const agoraIso = new Date().toISOString()

    if (!apiKey || !companyId) {
      return {
        sucesso: false,
        modo: 'aguardando_credenciais',
        numeroNota: payload.numeroNota,
        codigoVerificacao: payload.codigoVerificacao,
        dataHoraCancelamento: agoraIso,
        xmlCancelamento: '',
        mensagemRetorno: 'Credenciais NFE.io ausentes para efetuar o cancelamento em produção.',
        erroRejeicao: {
          codigo: 'CREDENCIAIS_AUSENTES',
          mensagem: 'Preencha a Chave de API e o Company ID da NFE.io na configuração.',
        },
      }
    }

    try {
      const endpoint = `${this.defaultBaseUrl}/v1/companies/${encodeURIComponent(companyId)}/serviceinvoices/${encodeURIComponent(invoiceId)}`

      const resp = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: apiKey,
        },
      })

      if (resp.ok) {
        const dados = await resp.json().catch(() => ({}))
        return {
          sucesso: true,
          modo: 'nfeio_real',
          numeroNota: payload.numeroNota,
          codigoVerificacao: payload.codigoVerificacao,
          protocoloCancelamento: String(dados.id || `CANC-NFEIO-${Date.now()}`),
          dataHoraCancelamento: agoraIso,
          xmlCancelamento: '',
          mensagemRetorno: 'Solicitação de cancelamento transmitida com sucesso para a NFE.io.',
          rawResponse: dados,
        }
      } else {
        const rawText = await resp.text()
        return {
          sucesso: false,
          modo: 'nfeio_real',
          numeroNota: payload.numeroNota,
          codigoVerificacao: payload.codigoVerificacao,
          dataHoraCancelamento: agoraIso,
          xmlCancelamento: '',
          mensagemRetorno: `Falha ao cancelar na NFE.io (HTTP ${resp.status}): ${rawText.slice(0, 300)}`,
          erroRejeicao: {
            codigo: String(resp.status),
            mensagem: rawText,
          },
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      return {
        sucesso: false,
        modo: 'nfeio_real',
        numeroNota: payload.numeroNota,
        codigoVerificacao: payload.codigoVerificacao,
        dataHoraCancelamento: agoraIso,
        xmlCancelamento: '',
        mensagemRetorno: `Erro de rede no cancelamento NFE.io: ${errMsg}`,
      }
    }
  }
}

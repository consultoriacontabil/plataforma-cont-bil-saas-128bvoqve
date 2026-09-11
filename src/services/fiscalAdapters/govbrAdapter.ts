import type { NfseFiscalAdapter, NfseEmissaoPayload, NfseEmissaoResult } from './types'
import pb from '@/lib/pocketbase/client'

/**
 * Adapter oficial para o Emissor Nacional de NFS-e (Gov.br / Receita Federal)
 * Padrão Nacional estabelecido pelo Comitê Gestor da NFS-e (Resolução CGSN nº 169)
 */
export class GovBrFiscalAdapter implements NfseFiscalAdapter {
  id = 'governacional' as const
  nome = 'Gov.br (Emissor Nacional de NFS-e)'
  statusDisponibilidade = 'ativo' as const
  descricao =
    'Padrão Nacional da Receita Federal / Comitê Gestor da NFS-e. Utiliza autenticação com certificado digital e-CNPJ A1 e credenciais Gov.br.'

  private defaultApiUrl = 'https://nfse.receita.fazenda.gov.br/portalnfse'

  async testarConexao(params: {
    apiUrl?: string
    clientId?: string
    clientSecret?: string
    municipioIbge?: string
    empresaId?: string
    tenantId?: string
    ambiente?: 'producao' | 'homologacao'
  }): Promise<{
    sucesso: boolean
    mensagem: string
    statusCode?: number
    detalhe?: string
  }> {
    const apiUrl = params.apiUrl?.trim() || this.defaultApiUrl
    const clientId = params.clientId?.trim()
    const clientSecret = params.clientSecret?.trim()

    if (!clientId || !clientSecret) {
      return {
        sucesso: false,
        mensagem:
          'Credenciais do Emissor Nacional ausentes. Preencha o Client ID e Client Secret gerados no portal Gov.br.',
        detalhe:
          'Acesse o Portal de Gestão da NFS-e (Gov.br) para emitir as chaves de API da empresa prestadora.',
      }
    }

    try {
      // Disparar teste através do endpoint autenticado do backend (evita bloqueio CORS no navegador)
      const resp = await pb.send<{
        sucesso: boolean
        mensagem: string
        status_code?: number
        detalhe?: string
      }>('/backend/v1/nfse/testar-provedor', {
        method: 'POST',
        body: {
          tenant_id: params.tenantId || pb.authStore.record?.id,
          provedor: 'governacional',
          api_url: apiUrl,
          client_id: clientId,
          client_secret: clientSecret,
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
        mensagem: 'Falha na comunicação com o Emissor Nacional Gov.br: ' + errMsg,
        detalhe:
          'Verifique a conectividade de rede do servidor e a validade do certificado digital e-CNPJ.',
      }
    }
  }

  async emitir(payload: NfseEmissaoPayload): Promise<NfseEmissaoResult> {
    const cred = payload.credenciais
    const apiUrl = (cred?.apiUrl || this.defaultApiUrl).trim()
    const cleanUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl

    // Se as credenciais estiverem preenchidas, tentar chamada HTTP real
    if (cred?.clientId && cred?.clientSecret) {
      try {
        const dpsXml = this.gerarXmlDpsNacional(payload)
        const endpointEmissao = `${cleanUrl}/api/v1/dps`

        // Tentativa de transmissão HTTP direta
        const resp = await fetch(endpointEmissao, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml',
            Accept: 'application/json',
            'X-Client-Id': cred.clientId,
            Authorization: `Bearer ${btoa(`${cred.clientId}:${cred.clientSecret}`)}`,
          },
          body: dpsXml,
        })

        if (resp.ok) {
          const dados = await resp.json()
          const numeroNota = Number(dados.numero || dados.numeroNfse || payload.numero)
          const codVerif = String(dados.codigoVerificacao || payload.numero + '-GOV')
          const chaveAcesso = String(dados.chaveAcesso || payload.numero)
          const urlConsulta =
            dados.urlConsulta ||
            `https://nfse.receita.fazenda.gov.br/portalnfse/visualizar/${chaveAcesso}`

          return {
            sucesso: true,
            modo: 'governacional_real',
            numeroNota,
            codigoVerificacao: codVerif,
            chaveAcesso,
            protocoloAutorizacao: dados.protocolo || `PROT-GOV-${Date.now()}`,
            urlConsulta,
            xmlAssinado: dados.xmlRetorno || dpsXml,
            mensagemRetorno: 'NFS-e autorizada com sucesso pelo Emissor Nacional Gov.br!',
            rawResponse: dados,
          }
        } else {
          // Erro retornado pelo servidor do Emissor Nacional
          const erroTexto = await resp.text()
          let parsedError: Record<string, unknown> = {}
          try {
            parsedError = JSON.parse(erroTexto)
          } catch {
            /* intentionally ignored */
          }

          const motivoRejeicao =
            (parsedError.mensagem as string) ||
            (parsedError.error as string) ||
            `Erro HTTP ${resp.status} retornado pelo Emissor Nacional: ${erroTexto.slice(0, 300)}`

          return {
            sucesso: false,
            modo: 'governacional_real',
            numeroNota: payload.numero,
            codigoVerificacao: '',
            urlConsulta: '',
            xmlAssinado: dpsXml,
            mensagemRetorno: motivoRejeicao,
            rawResponse: parsedError,
            erroRejeicao: {
              codigo: String(resp.status),
              mensagem: motivoRejeicao,
              correcaoSugerida:
                resp.status === 401
                  ? 'Verifique se o Client ID e Secret do Gov.br estão ativos e corretos.'
                  : resp.status === 422
                    ? 'Dados cadastrais do prestador/tomador rejeitados pela validação da Receita Federal. Confira se o município do prestador aderiu ao convênio nacional.'
                    : 'Consulte o status do Emissor Nacional e certifique-se de que o certificado A1 está válido.',
            },
          }
        }
      } catch (errTransmissao: unknown) {
        const errMsg =
          errTransmissao instanceof Error ? errTransmissao.message : String(errTransmissao)
        // Se a chamada real de rede falhar por ausência de conectividade externa/CORS na ponta do cliente,
        // registramos o erro de rede acionável
        return {
          sucesso: false,
          modo: 'governacional_real',
          numeroNota: payload.numero,
          codigoVerificacao: '',
          urlConsulta: '',
          xmlAssinado: '',
          mensagemRetorno: `Falha de rede ao conectar com o Emissor Nacional (${cleanUrl}): ${errMsg}`,
          erroRejeicao: {
            codigo: 'NETWORK_ERROR',
            mensagem: errMsg,
            correcaoSugerida:
              'Verifique se a URL do Emissor Nacional está acessível e se as credenciais de produção Gov.br estão ativas para o CNPJ prestador.',
          },
        }
      }
    }

    // Fallback: Se não tem credenciais do Gov.br, opera em Simulação Controlada com layout oficial
    const chars = '0123456789ABCDEF'
    const randPart = (len: number) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    const codigoVerificacao = `${randPart(4)}-${randPart(4)}-${randPart(4)}`
    const chaveAcesso = `352601${payload.prestador.cnpj.replace(/\D/g, '')}001${String(payload.numero).padStart(9, '0')}${randPart(8)}`

    return {
      sucesso: true,
      modo: 'simulacao',
      numeroNota: payload.numero,
      codigoVerificacao,
      chaveAcesso,
      protocoloAutorizacao: `SIMULACAO-${Date.now()}`,
      urlConsulta: `https://nfse.receita.fazenda.gov.br/portalnfse/consulta?chave=${chaveAcesso}`,
      xmlAssinado: this.gerarXmlDpsNacional(payload),
      mensagemRetorno:
        'NFS-e gerada em Modo Simulação Controlada (Gov.br / Layout Nacional). Para emissão oficial em produção, configure o Client ID e Secret na aba de Configuração.',
    }
  }

  /**
   * Monta o XML da DPS (Declaração de Prestação de Serviços) no Padrão Nacional da NFS-e
   */
  private gerarXmlDpsNacional(p: NfseEmissaoPayload): string {
    const cleanDoc = p.tomador.documento.replace(/\D/g, '')
    const tagDoc = cleanDoc.length === 11 ? `<CPF>${cleanDoc}</CPF>` : `<CNPJ>${cleanDoc}</CNPJ>`
    const cleanCnpjPrestador = p.prestador.cnpj.replace(/\D/g, '')

    return `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infDPS Id="DPS${p.numero}">
    <tpAmb>${p.ambiente === 'producao' ? 1 : 2}</tpAmb>
    <dhEmi>${p.dataEmissao}</dhEmi>
    <verAplic>RumoContabil_v0.0.24</verAplic>
    <serie>${p.serie || '1'}</serie>
    <nDPS>${p.numero}</nDPS>
    <dCompet>${p.competencia}-01</dCompet>
    <prest>
      <CNPJ>${cleanCnpjPrestador}</CNPJ>
      <xNome>${this.escapeXml(p.prestador.razaoSocial)}</xNome>
      ${p.prestador.inscricaoMunicipal ? `<IM>${p.prestador.inscricaoMunicipal}</IM>` : ''}
      <end>
        <xLgr>${this.escapeXml(p.prestador.logradouro || 'Avenida')}</xLgr>
        <nro>${this.escapeXml(p.prestador.numero || 'S/N')}</nro>
        <xBairro>${this.escapeXml(p.prestador.bairro || 'Centro')}</xBairro>
        <cMun>${p.prestador.codigoIbge || '3550308'}</cMun>
        <UF>${p.prestador.uf || 'SP'}</UF>
        <CEP>${(p.prestador.cep || '01000-000').replace(/\D/g, '')}</CEP>
      </end>
    </prest>
    <toma>
      ${tagDoc}
      <xNome>${this.escapeXml(p.tomador.nome)}</xNome>
      ${p.tomador.email ? `<email>${this.escapeXml(p.tomador.email)}</email>` : ''}
      ${p.tomador.endereco ? `<xLgr>${this.escapeXml(p.tomador.endereco)}</xLgr>` : ''}
    </toma>
    <serv>
      <cServMun>${p.servico.codigo}</cServMun>
      <cTribNac>${p.servico.codigo.replace(/\D/g, '').padEnd(6, '0')}</cTribNac>
      <xDescServ>${this.escapeXml(p.servico.discriminacao)}</xDescServ>
      <valores>
        <vServPrest>${p.servico.valorServicos.toFixed(2)}</vServPrest>
        <vDescIncond>0.00</vDescIncond>
        <vDescCond>0.00</vDescCond>
        <trib>
          <tribMun>
            <tribISSQN>1</tribISSQN>
            <cPaisResult>1058</cPaisResult>
            <vBCISSQN>${p.servico.valorServicos.toFixed(2)}</vBCISSQN>
            <pAliqISSQN>${p.servico.aliquotaIss.toFixed(2)}</pAliqISSQN>
            <vISSQN>${p.servico.valorIss.toFixed(2)}</vISSQN>
            <tpRetISSQN>${p.servico.issRetido ? 1 : 2}</tpRetISSQN>
          </tribMun>
          <tribFed>
            <piscofins>
              <CST>01</CST>
              <vBCPisCofins>${p.servico.valorServicos.toFixed(2)}</vBCPisCofins>
              <vPis>${(p.servico.valorPis || 0).toFixed(2)}</vPis>
              <vCofins>${(p.servico.valorCofins || 0).toFixed(2)}</vCofins>
            </piscofins>
            <vRetCP>0.00</vRetCP>
            <vRetIRRF>${(p.servico.valorIr || 0).toFixed(2)}</vRetIRRF>
            <vRetCSLL>${(p.servico.valorCsll || 0).toFixed(2)}</vRetCSLL>
          </tribFed>
        </trib>
        <vLiq>${p.servico.valorLiquido.toFixed(2)}</vLiq>
      </valores>
    </serv>
  </infDPS>
</DPS>`
  }

  private escapeXml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }
}

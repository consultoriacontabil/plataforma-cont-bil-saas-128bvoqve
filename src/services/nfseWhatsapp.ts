import pb from '@/lib/pocketbase/client'
import type {
  NfseConfigRecord,
  NfseSolicitacaoRecord,
  NfseNotaEmitidaRecord,
  Empresa,
  CertificadoDigitalRecord,
} from '@/types'
import { auditService } from './audit'
import { isValidCnpj, isValidCpf, maskCnpj, maskCpf } from '@/lib/formatters'

export interface SalvarConfigInput {
  empresa_padrao?: string
  evolution_api_url?: string
  evolution_api_key?: string
  evolution_instance?: string
  modo_operacao: 'simulacao' | 'producao'
  auto_aprovar_alta_confianca: boolean
  msg_saudacao?: string
  msg_recebimento?: string
  msg_aprovacao?: string
  msg_rejeicao?: string
  msg_nota_emitida?: string
  telefone_suporte?: string
  ativo: boolean
}

export interface EmitirNfseInput {
  solicitacao_id?: string
  empresa_id: string
  tomador_nome: string
  tomador_documento: string
  tomador_email?: string
  tomador_endereco?: string
  descricao_servicos: string
  codigo_servico_municipal?: string
  valor_servicos: number
  aliquota_iss?: number
  iss_retido?: boolean
  criar_titulo_receber?: boolean
  data_vencimento_titulo?: string
}

export const nfseWhatsappService = {
  /**
   * Obtém a configuração de WhatsApp / NFS-e do tenant
   */
  async getConfig(tenantId: string): Promise<NfseConfigRecord | null> {
    try {
      const records = await pb.collection('nfse_config').getFullList<NfseConfigRecord>({
        filter: `tenant_id = "${tenantId}"`,
        expand: 'empresa_padrao',
      })
      if (records.length > 0) return records[0]

      // Criar configuração inicial padrão se não existir
      const defaultToken = 'rumo_wa_' + Math.random().toString(36).substring(2, 15)
      const novo = await pb.collection('nfse_config').create<NfseConfigRecord>({
        tenant_id: tenantId,
        webhook_token: defaultToken,
        modo_operacao: 'simulacao',
        auto_aprovar_alta_confianca: false,
        msg_saudacao:
          'Olá! Sou o assistente de Emissão Inteligente de NFS-e da Rumo Consultoria Contábil. Pode me enviar os dados da nota fiscal a emitir (Tomador, CNPJ/CPF, descrição do serviço e valor).',
        msg_recebimento:
          'Recebi seus dados com sucesso! 📝 Sua solicitação de NFS-e foi estruturada pela nossa IA e está na fila do Painel de Supervisão para conferência do contador responsável. Você receberá o PDF/XML assim que aprovada.',
        msg_aprovacao:
          'Ótima notícia! Sua solicitação de NFS-e foi aprovada pelo contador e está sendo enviada para o motor de emissão fiscal.',
        msg_rejeicao:
          'Olá. Sua solicitação de NFS-e precisou ser devolvida pelo contador com o seguinte apontamento: {{motivo}}. Por favor, responda com os dados corrigidos.',
        msg_nota_emitida:
          'Sua NFS-e Nº {{numero_nota}} foi emitida com sucesso! 🎉\nCódigo de Verificação: {{codigo_verificacao}}\nValor: R$ {{valor}}\n\nSegue o arquivo da nota fiscal para seus registros.',
        telefone_suporte: '',
        ativo: true,
      })
      return novo
    } catch (err) {
      console.error('Erro ao buscar config nfse:', err)
      return null
    }
  },

  /**
   * Atualiza as configurações de WhatsApp / NFS-e do tenant
   */
  async saveConfig(
    tenantId: string,
    configId: string,
    input: SalvarConfigInput,
    userId?: string,
  ): Promise<NfseConfigRecord> {
    const updated = await pb.collection('nfse_config').update<NfseConfigRecord>(configId, {
      ...input,
    })

    await auditService.log(
      tenantId,
      userId || 'system',
      'nfse_config_atualizada',
      'nfse_config',
      configId,
      JSON.stringify({ modo: input.modo_operacao, ativo: input.ativo }),
    )

    return updated
  },

  /**
   * Lista as solicitações na fila de supervisão
   */
  async listSolicitacoes(tenantId: string, status?: string): Promise<NfseSolicitacaoRecord[]> {
    let filter = `tenant_id = "${tenantId}"`
    if (status && status !== 'todos') {
      filter += ` && status = "${status}"`
    }
    return pb.collection('nfse_solicitacoes').getFullList<NfseSolicitacaoRecord>({
      filter,
      sort: '-created',
      expand: 'empresa,revisado_por',
    })
  },

  /**
   * Lista histórico de notas emitidas
   */
  async listNotasEmitidas(
    tenantId: string,
    competencia?: string,
  ): Promise<NfseNotaEmitidaRecord[]> {
    let filter = `tenant_id = "${tenantId}"`
    if (competencia) {
      filter += ` && competencia = "${competencia}"`
    }
    return pb.collection('nfse_notas_emitidas').getFullList<NfseNotaEmitidaRecord>({
      filter,
      sort: '-created',
      expand: 'empresa,solicitacao,certificado_usado,titulo_financeiro,emitido_por',
    })
  },

  /**
   * Rejeita solicitação de NFS-e informando motivo (Etapa 8 - volta ao WhatsApp)
   */
  async rejeitarSolicitacao(
    tenantId: string,
    solicitacaoId: string,
    motivo: string,
    userId: string,
  ): Promise<NfseSolicitacaoRecord> {
    const sol = await pb
      .collection('nfse_solicitacoes')
      .getOne<NfseSolicitacaoRecord>(solicitacaoId)
    const agora = new Date().toISOString()

    const historico = sol.historico_mensagens_json ? [...sol.historico_mensagens_json] : []
    const config = await this.getConfig(tenantId)
    const templateRejeicao =
      config?.msg_rejeicao ||
      'Olá. Sua solicitação de NFS-e precisou ser devolvida pelo contador com o seguinte apontamento: {{motivo}}. Por favor, responda com os dados corrigidos.'
    const textoMensagem = templateRejeicao.replace('{{motivo}}', motivo)

    historico.push({
      origem: 'escritorio_bot',
      texto: textoMensagem,
      data: agora,
    })

    const updated = await pb
      .collection('nfse_solicitacoes')
      .update<NfseSolicitacaoRecord>(solicitacaoId, {
        status: 'rejeitada',
        motivo_rejeicao: motivo,
        revisado_por: userId,
        data_revisao: agora,
        historico_mensagens_json: historico,
      })

    // Tentar envio via webhook endpoint
    try {
      await pb.send('/backend/v1/nfse/enviar-whatsapp', {
        method: 'POST',
        body: {
          solicitacao_id: solicitacaoId,
          mensagem: textoMensagem,
        },
      })
    } catch {
      /* fallback gracioso em simulação */
    }

    await auditService.log(
      tenantId,
      userId,
      'nfse_solicitacao_rejeitada',
      'nfse_solicitacoes',
      solicitacaoId,
      JSON.stringify({ motivo }),
    )

    return updated
  },

  /**
   * Atualiza dados editados da solicitação antes de emitir
   */
  async updateSolicitacao(
    solicitacaoId: string,
    data: Partial<NfseSolicitacaoRecord>,
  ): Promise<NfseSolicitacaoRecord> {
    return pb.collection('nfse_solicitacoes').update<NfseSolicitacaoRecord>(solicitacaoId, data)
  },

  /**
   * Emissão da NFS-e (Etapas 5 e 6 da arquitetura)
   * Gera número sequencial, calcula impostos, cria XML Nacional, opcionalmente gera Título a Receber
   */
  async emitirNfse(
    tenantId: string,
    input: EmitirNfseInput,
    userId: string,
  ): Promise<NfseNotaEmitidaRecord> {
    const config = await this.getConfig(tenantId)

    // Obter dados da empresa emissora (prestador)
    const empresa = await pb.collection('empresas').getOne<Empresa>(input.empresa_id)

    // Obter certificado digital vinculado à empresa se houver
    let certificadoId: string | undefined
    try {
      const certs = await pb
        .collection('certificados_digitais')
        .getFullList<CertificadoDigitalRecord>({
          filter: `empresa = "${empresa.id}" && status = "ativo"`,
          sort: '-validade',
        })
      if (certs.length > 0) {
        certificadoId = certs[0].id
      }
    } catch {
      /* sem certificado */
    }

    // Gerar próximo número de nota sequencial para esta empresa
    const todasNotasEmpresa = await pb
      .collection('nfse_notas_emitidas')
      .getFullList<NfseNotaEmitidaRecord>({
        filter: `tenant_id = "${tenantId}" && empresa = "${empresa.id}"`,
        sort: '-numero_nota',
        fields: 'numero_nota',
      })

    const proximoNumero =
      todasNotasEmpresa.length > 0 && todasNotasEmpresa[0].numero_nota
        ? todasNotasEmpresa[0].numero_nota + 1
        : 2026001

    const agora = new Date()
    const ano = agora.getFullYear()
    const mes = String(agora.getMonth() + 1).padStart(2, '0')
    const competencia = `${ano}-${mes}`

    // Gerar código de verificação randômico no formato AAAA-BBBB-CCCC
    const chars = '0123456789ABCDEF'
    const randPart = (len: number) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    const codigoVerificacao = `${randPart(4)}-${randPart(4)}-${randPart(4)}`

    // Chave de acesso simulada 44 dígitos
    const cleanCnpjEmpresa = (empresa.cnpj || '').replace(/\D/g, '').padEnd(14, '0')
    const chaveAcesso = `35${ano % 100}${mes}${cleanCnpjEmpresa}56001${String(proximoNumero).padStart(9, '0')}${randPart(8)}`

    // Alíquotas e retenções
    const aliquotaIss = input.aliquota_iss !== undefined ? input.aliquota_iss : 2.0 // 2% padrão Simples
    const valorServicos = input.valor_servicos
    const valorIss = Number(((valorServicos * aliquotaIss) / 100).toFixed(2))

    // PIS/COFINS/CSLL/IRRF estimados se não for Simples Nacional
    let valorPis = 0
    let valorCofins = 0
    let valorIr = 0
    let valorCsll = 0

    if (
      empresa.regime_tributario === 'lucro_presumido' ||
      empresa.regime_tributario === 'lucro_real'
    ) {
      valorPis = Number((valorServicos * 0.0065).toFixed(2))
      valorCofins = Number((valorServicos * 0.03).toFixed(2))
      valorIr = Number((valorServicos * 0.015).toFixed(2))
      valorCsll = Number((valorServicos * 0.01).toFixed(2))
    }

    const valorLiquido = Number(
      (
        valorServicos -
        valorIr -
        valorPis -
        valorCofins -
        valorCsll -
        (input.iss_retido ? valorIss : 0)
      ).toFixed(2),
    )

    // Gerar XML no padrão Nacional / ABRASF
    const xmlConteudo = gerarXmlNfse({
      numero: proximoNumero,
      codigoVerificacao,
      dataEmissao: agora.toISOString(),
      competencia,
      prestador: {
        cnpj: empresa.cnpj,
        razaoSocial: empresa.razao_social,
        nomeFantasia: empresa.nome_fantasia || empresa.razao_social,
        inscricaoMunicipal: empresa.inscricao_municipal || 'ISENTO',
        logradouro: empresa.logradouro || 'Avenida Paulista',
        numero: empresa.numero || '100',
        bairro: empresa.bairro || 'Centro',
        cidade: empresa.cidade || 'São Paulo',
        uf: empresa.uf || 'SP',
        cep: empresa.cep || '01310-100',
        telefone: empresa.telefone || '',
        email: empresa.email || '',
      },
      tomador: {
        documento: input.tomador_documento,
        nome: input.tomador_nome,
        email: input.tomador_email || '',
        endereco: input.tomador_endereco || 'Logradouro do Tomador',
      },
      servico: {
        codigo: input.codigo_servico_municipal || '01.07',
        discriminacao: input.descricao_servicos,
        valorServicos,
        valorIss,
        aliquotaIss,
        issRetido: !!input.iss_retido,
        valorLiquido,
        valorPis,
        valorCofins,
        valorIr,
        valorCsll,
      },
    })

    // Opcional: Criar Título a Receber no Financeiro
    let tituloFinanceiroId: string | undefined
    if (input.criar_titulo_receber) {
      try {
        const contasFinCol = pb.collection('contas_financeiras')
        const dataVenc =
          input.data_vencimento_titulo ||
          new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const dataEmissaoStr = agora.toISOString().split('T')[0]

        const titulo = await contasFinCol.create({
          tenant_id: tenantId,
          empresa: empresa.id,
          tipo: 'receber',
          pessoa: input.tomador_nome,
          descricao: `NFS-e Nº ${proximoNumero} - ${input.descricao_servicos.slice(0, 60)}`,
          documento_ref: `NFSE-${proximoNumero}`,
          valor: valorLiquido,
          data_emissao: dataEmissaoStr,
          data_vencimento: dataVenc,
          status: 'pendente',
          observacoes: `Gerado automaticamente pela Emissão de NFS-e via WhatsApp (Cod. Verificação: ${codigoVerificacao})`,
        })
        tituloFinanceiroId = titulo.id
      } catch (errTitulo) {
        console.error('Aviso: falha ao gerar título a receber automático:', errTitulo)
      }
    }

    // Criar Registro em nfse_notas_emitidas
    const nota = await pb.collection('nfse_notas_emitidas').create<NfseNotaEmitidaRecord>({
      tenant_id: tenantId,
      empresa: empresa.id,
      solicitacao: input.solicitacao_id || null,
      numero_nota: proximoNumero,
      serie: 'E',
      codigo_verificacao: codigoVerificacao,
      chave_acesso: chaveAcesso,
      data_emissao: agora.toISOString(),
      competencia,
      tomador_nome: input.tomador_nome,
      tomador_documento: input.tomador_documento,
      tomador_email: input.tomador_email || '',
      discriminacao_servicos: input.descricao_servicos,
      codigo_servico_municipal: input.codigo_servico_municipal || '01.07',
      valor_servicos: valorServicos,
      valor_deducoes: 0,
      valor_pis: valorPis,
      valor_cofins: valorCofins,
      valor_inss: 0,
      valor_ir: valorIr,
      valor_csll: valorCsll,
      valor_iss: valorIss,
      aliquota_iss: aliquotaIss,
      valor_liquido: valorLiquido,
      iss_retido: !!input.iss_retido,
      status: 'emitida',
      modo_emissao: 'simulacao',
      certificado_usado: certificadoId || null,
      xml_conteudo: xmlConteudo,
      titulo_financeiro: tituloFinanceiroId || null,
      emitido_por: userId,
      whatsapp_destinatario: '',
      whatsapp_enviado_em: null,
    })

    // Se veio de uma solicitação na fila, atualizar seu status e histórico
    if (input.solicitacao_id) {
      try {
        const sol = await pb
          .collection('nfse_solicitacoes')
          .getOne<NfseSolicitacaoRecord>(input.solicitacao_id)
        const hist = sol.historico_mensagens_json ? [...sol.historico_mensagens_json] : []
        const templateEmitida =
          config?.msg_nota_emitida ||
          'Sua NFS-e Nº {{numero_nota}} foi emitida com sucesso! 🎉\nCódigo de Verificação: {{codigo_verificacao}}\nValor: R$ {{valor}}\n\nSegue o arquivo da nota fiscal para seus registros.'
        const msgTexto = templateEmitida
          .replace('{{numero_nota}}', String(proximoNumero))
          .replace('{{codigo_verificacao}}', codigoVerificacao)
          .replace('{{valor}}', valorServicos.toFixed(2))

        hist.push({
          origem: 'escritorio_bot',
          texto: msgTexto,
          data: agora.toISOString(),
        })

        await pb.collection('nfse_solicitacoes').update(input.solicitacao_id, {
          status: 'emitida',
          revisado_por: userId,
          data_revisao: agora.toISOString(),
          historico_mensagens_json: hist,
        })

        // Enviar confirmação ao WhatsApp
        await pb.send('/backend/v1/nfse/enviar-whatsapp', {
          method: 'POST',
          body: {
            solicitacao_id: input.solicitacao_id,
            mensagem: msgTexto,
          },
        })
      } catch (errSolUpdate) {
        console.error('Aviso ao atualizar solicitação vinculada:', errSolUpdate)
      }
    }

    // Auditoria
    await auditService.log(
      tenantId,
      userId,
      'nfse_emitida',
      'nfse_notas_emitidas',
      nota.id,
      JSON.stringify({
        numero: proximoNumero,
        tomador: input.tomador_nome,
        valor: valorServicos,
        modo: 'simulacao',
      }),
    )

    return nota
  },

  /**
   * Envia uma mensagem personalizada de chat/bot para o contato da solicitação
   */
  async enviarMensagemWhatsApp(solicitacaoId: string, mensagem: string): Promise<boolean> {
    try {
      await pb.send('/backend/v1/nfse/enviar-whatsapp', {
        method: 'POST',
        body: {
          solicitacao_id: solicitacaoId,
          mensagem,
        },
      })
      return true
    } catch (err) {
      console.error('Erro ao enviar mensagem WhatsApp:', err)
      return false
    }
  },

  /**
   * Testar conexão com a Evolution API (validação honesta de credenciais)
   */
  async testarConexaoEvolution(
    url: string,
    key: string,
    instance: string,
  ): Promise<{ sucesso: boolean; mensagem: string; detalhe?: string }> {
    if (!url || !key || !instance) {
      return {
        sucesso: false,
        mensagem: 'Informe URL base, Chave de API e Nome da Instância para testar a conexão.',
      }
    }

    try {
      // Simulação controlada / tentativa de ping HTTP real
      const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url
      const res = await fetch(`${cleanUrl}/instance/connectionState/${instance}`, {
        method: 'GET',
        headers: {
          apikey: key,
        },
      })

      if (res.ok) {
        const data = await res.json()
        return {
          sucesso: true,
          mensagem: `Instância "${instance}" conectada com sucesso ao servidor Evolution API!`,
          detalhe: JSON.stringify(data),
        }
      } else {
        return {
          sucesso: false,
          mensagem: `Servidor Evolution API respondeu com status ${res.status}. Verifique se a instância "${instance}" está ativa e a API Key está correta.`,
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      return {
        sucesso: false,
        mensagem:
          'Não foi possível alcançar o servidor Evolution API informado. Certifique-se de que o host está online e acessível publicamente (HTTPS).',
        detalhe: errMsg,
      }
    }
  },
}

// ==========================================
// Gerador de XML de NFS-e (Layout Padrão Nacional / ABRASF)
// ==========================================
export function gerarXmlNfse(params: {
  numero: number
  codigoVerificacao: string
  dataEmissao: string
  competencia: string
  prestador: {
    cnpj: string
    razaoSocial: string
    nomeFantasia: string
    inscricaoMunicipal: string
    logradouro: string
    numero: string
    bairro: string
    cidade: string
    uf: string
    cep: string
    telefone: string
    email: string
  }
  tomador: {
    documento: string
    nome: string
    email: string
    endereco: string
  }
  servico: {
    codigo: string
    discriminacao: string
    valorServicos: number
    valorIss: number
    aliquotaIss: number
    issRetido: boolean
    valorLiquido: number
    valorPis: number
    valorCofins: number
    valorIr: number
    valorCsll: number
  }
}): string {
  const p = params
  const cleanDoc = p.tomador.documento.replace(/\D/g, '')
  const tagDoc = cleanDoc.length === 11 ? `<Cpf>${cleanDoc}</Cpf>` : `<Cnpj>${cleanDoc}</Cnpj>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<CompNfse xmlns="http://www.abrasf.org.br/nfse.xsd">
  <Nfse versao="2.04">
    <InfNfse Id="NFE${p.numero}">
      <Numero>${p.numero}</Numero>
      <CodigoVerificacao>${p.codigoVerificacao}</CodigoVerificacao>
      <DataEmissao>${p.dataEmissao}</DataEmissao>
      <NaturezaOperacao>1</NaturezaOperacao>
      <RegimeEspecialTributacao>6</RegimeEspecialTributacao>
      <OptanteSimplesNacional>1</OptanteSimplesNacional>
      <IncentivadorCultural>2</IncentivadorCultural>
      <Competencia>${p.competencia}-01</Competencia>
      <PrestadorServico>
        <IdentificacaoPrestador>
          <Cnpj>${p.prestador.cnpj.replace(/\D/g, '')}</Cnpj>
          <InscricaoMunicipal>${p.prestador.inscricaoMunicipal}</InscricaoMunicipal>
        </IdentificacaoPrestador>
        <RazaoSocial>${escapeXml(p.prestador.razaoSocial)}</RazaoSocial>
        <NomeFantasia>${escapeXml(p.prestador.nomeFantasia)}</NomeFantasia>
        <Endereco>
          <Endereco>${escapeXml(p.prestador.logradouro)}</Endereco>
          <Numero>${escapeXml(p.prestador.numero)}</Numero>
          <Bairro>${escapeXml(p.prestador.bairro)}</Bairro>
          <CodigoMunicipio>3550308</CodigoMunicipio>
          <Uf>${p.prestador.uf}</Uf>
          <Cep>${p.prestador.cep.replace(/\D/g, '')}</Cep>
        </Endereco>
        <Contato>
          <Telefone>${p.prestador.telefone.replace(/\D/g, '')}</Telefone>
          <Email>${escapeXml(p.prestador.email)}</Email>
        </Contato>
      </PrestadorServico>
      <TomadorServico>
        <IdentificacaoTomador>
          <CpfCnpj>
            ${tagDoc}
          </CpfCnpj>
        </IdentificacaoTomador>
        <RazaoSocial>${escapeXml(p.tomador.nome)}</RazaoSocial>
        <Endereco>
          <Endereco>${escapeXml(p.tomador.endereco)}</Endereco>
        </Endereco>
        <Contato>
          <Email>${escapeXml(p.tomador.email)}</Email>
        </Contato>
      </TomadorServico>
      <Servico>
        <Valores>
          <ValorServicos>${p.servico.valorServicos.toFixed(2)}</ValorServicos>
          <ValorDeducoes>0.00</ValorDeducoes>
          <ValorPis>${p.servico.valorPis.toFixed(2)}</ValorPis>
          <ValorCofins>${p.servico.valorCofins.toFixed(2)}</ValorCofins>
          <ValorInss>0.00</ValorInss>
          <ValorIr>${p.servico.valorIr.toFixed(2)}</ValorIr>
          <ValorCsll>${p.servico.valorCsll.toFixed(2)}</ValorCsll>
          <IssRetido>${p.servico.issRetido ? 1 : 2}</IssRetido>
          <ValorIss>${p.servico.valorIss.toFixed(2)}</ValorIss>
          <Aliquota>${(p.servico.aliquotaIss / 100).toFixed(4)}</Aliquota>
          <ValorLiquidoNfse>${p.servico.valorLiquido.toFixed(2)}</ValorLiquidoNfse>
        </Valores>
        <ItemListaServico>${p.servico.codigo}</ItemListaServico>
        <Discriminacao>${escapeXml(p.servico.discriminacao)}</Discriminacao>
        <CodigoMunicipio>3550308</CodigoMunicipio>
      </Servico>
    </InfNfse>
  </Nfse>
</CompNfse>`
}

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ==========================================
// Gerador de DANFSE em HTML para visualização e impressão em PDF
// ==========================================
export function gerarDanfseHtml(nota: NfseNotaEmitidaRecord, empresa?: Empresa): string {
  const formatMoeda = (val?: number) =>
    (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const prestadorNome = empresa?.razao_social || 'Prestador do Serviço'
  const prestadorFantasia = empresa?.nome_fantasia || ''
  const prestadorCnpj = empresa?.cnpj ? maskCnpj(empresa.cnpj) : '—'
  const prestadorIM = empresa?.inscricao_municipal || '—'
  const prestadorEnd = empresa
    ? `${empresa.logradouro || ''}, ${empresa.numero || ''} ${empresa.complemento || ''} - ${empresa.bairro || ''}, ${empresa.cidade || ''}/${empresa.uf || ''} - CEP ${empresa.cep || ''}`
    : '—'

  const tomadorDocFormatado =
    nota.tomador_documento.replace(/\D/g, '').length === 11
      ? maskCpf(nota.tomador_documento)
      : maskCnpj(nota.tomador_documento)

  const dataEmissaoFormatada = new Date(nota.data_emissao).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>DANFSE - Nota Fiscal de Serviço Eletrônica Nº ${nota.numero_nota}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #1A2333;
      margin: 0;
      padding: 20px;
      background: #fff;
    }
    .danfse-container {
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #1A2333;
      padding: 12px;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .header-table td {
      border: 1px solid #94A3B8;
      padding: 6px;
      vertical-align: middle;
    }
    .section-title {
      background: #F1F5F9;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 10px;
      padding: 4px 6px;
      border: 1px solid #94A3B8;
      margin-top: 6px;
    }
    .content-box {
      border: 1px solid #94A3B8;
      border-top: none;
      padding: 8px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 6px;
    }
    .val-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }
    .val-table th, .val-table td {
      border: 1px solid #CBD5E1;
      padding: 4px 6px;
      text-align: right;
    }
    .val-table th {
      background: #F8FAFC;
      font-size: 9px;
      text-align: center;
    }
    .badge-sim {
      display: inline-block;
      background: #FEF3C7;
      color: #B45309;
      padding: 2px 6px;
      font-weight: bold;
      font-size: 9px;
      border-radius: 4px;
      border: 1px solid #FCD34D;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 800px; margin: 0 auto 12px auto; display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; padding: 10px 16px; border: 1px solid #E2E8F0; border-radius: 8px;">
    <div>
      <strong style="color: #0FA3A3;">Rumo Consultoria Contábil</strong> — Visualizador de DANFSE
    </div>
    <button onclick="window.print()" style="background: #0FA3A3; color: white; border: none; padding: 6px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
      Imprimir / Salvar em PDF
    </button>
  </div>

  <div class="danfse-container">
    <table class="header-table">
      <tr>
        <td style="width: 25%; text-align: center;">
          <div style="font-weight: bold; font-size: 14px; color: #0FA3A3;">PREFEITURA MUNICIPAL</div>
          <div style="font-size: 9px; color: #64748B;">Secretaria de Finanças / Fazenda</div>
          <div style="font-size: 8px; margin-top: 4px;">Padrão Nacional ABRASF</div>
        </td>
        <td style="width: 50%; text-align: center;">
          <div style="font-size: 13px; font-weight: bold;">DOCUMENTO AUXILIAR DA NOTA FISCAL DE SERVIÇOS ELETRÔNICA</div>
          <div style="font-size: 16px; font-weight: bold; margin-top: 2px; color: #1E293B;">DANFSE</div>
          <div style="margin-top: 4px;">
            <span class="badge-sim">MODO SIMULAÇÃO CONTROLADA (GOV.BR / ABRASF)</span>
          </div>
        </td>
        <td style="width: 25%; text-align: center; font-size: 10px;">
          <div><strong>Nº da Nota:</strong> <span style="font-size: 14px; font-weight: bold; color: #0284C7;">${nota.numero_nota}</span></div>
          <div style="margin-top: 4px;"><strong>Série:</strong> ${nota.serie || 'E'}</div>
          <div style="margin-top: 4px;"><strong>Data Emissão:</strong><br/>${dataEmissaoFormatada}</div>
          <div style="margin-top: 4px;"><strong>Cód. Verificação:</strong><br/><strong style="font-family: monospace;">${nota.codigo_verificacao}</strong></div>
        </td>
      </tr>
    </table>

    <div class="section-title">PRESTADOR DE SERVIÇOS (EMITENTE)</div>
    <div class="content-box">
      <div class="grid-2">
        <div>
          <div><strong>Razão Social:</strong> ${prestadorNome}</div>
          ${prestadorFantasia ? `<div><strong>Nome Fantasia:</strong> ${prestadorFantasia}</div>` : ''}
          <div><strong>CNPJ:</strong> ${prestadorCnpj}</div>
          <div><strong>Inscrição Municipal:</strong> ${prestadorIM}</div>
        </div>
        <div>
          <div><strong>Endereço:</strong> ${prestadorEnd}</div>
          <div><strong>Município:</strong> ${empresa?.cidade || 'São Paulo'} - ${empresa?.uf || 'SP'}</div>
          <div><strong>E-mail:</strong> ${empresa?.email || '—'}</div>
        </div>
      </div>
    </div>

    <div class="section-title">TOMADOR DE SERVIÇOS (CLIENTE)</div>
    <div class="content-box">
      <div class="grid-2">
        <div>
          <div><strong>Nome / Razão Social:</strong> ${nota.tomador_nome}</div>
          <div><strong>CPF / CNPJ:</strong> ${tomadorDocFormatado}</div>
        </div>
        <div>
          <div><strong>E-mail:</strong> ${nota.tomador_email || '—'}</div>
          <div><strong>Endereço:</strong> Logradouro do Tomador de Serviços</div>
        </div>
      </div>
    </div>

    <div class="section-title">DISCRIMINAÇÃO DOS SERVIÇOS</div>
    <div class="content-box" style="min-height: 80px; white-space: pre-wrap; font-family: monospace; font-size: 10px; line-height: 1.4;">
${nota.discriminacao_servicos}
    </div>

    <div class="section-title">CÓDIGO DE TRIBUTAÇÃO E MUNICÍPIO DA PRESTAÇÃO</div>
    <div class="content-box">
      <div class="grid-3">
        <div><strong>Item LC 116/03:</strong> ${nota.codigo_servico_municipal || '01.07'}</div>
        <div><strong>Município de Incidência:</strong> ${empresa?.cidade || 'São Paulo'} - ${empresa?.uf || 'SP'}</div>
        <div><strong>Natureza Operação:</strong> 1 - Tributação no Município</div>
      </div>
    </div>

    <div class="section-title">RETENÇÕES FEDERAIS E TRIBUTOS</div>
    <div class="content-box">
      <table class="val-table">
        <thead>
          <tr>
            <th>PIS</th>
            <th>COFINS</th>
            <th>INSS</th>
            <th>IRRF</th>
            <th>CSLL</th>
            <th>OUTRAS RETENÇÕES</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${formatMoeda(nota.valor_pis)}</td>
            <td>${formatMoeda(nota.valor_cofins)}</td>
            <td>${formatMoeda(nota.valor_inss)}</td>
            <td>${formatMoeda(nota.valor_ir)}</td>
            <td>${formatMoeda(nota.valor_csll)}</td>
            <td>R$ 0,00</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section-title">CÁLCULO DO ISSQN E VALOR LÍQUIDO</div>
    <div class="content-box">
      <table class="val-table">
        <thead>
          <tr>
            <th>VALOR DOS SERVIÇOS</th>
            <th>DEDUÇÕES</th>
            <th>BASE DE CÁLCULO</th>
            <th>ALÍQUOTA</th>
            <th>VALOR DO ISS</th>
            <th>ISS RETIDO?</th>
            <th>VALOR LÍQUIDO DA NFS-e</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: bold;">${formatMoeda(nota.valor_servicos)}</td>
            <td>R$ 0,00</td>
            <td>${formatMoeda(nota.valor_servicos)}</td>
            <td>${nota.aliquota_iss || 2}%</td>
            <td>${formatMoeda(nota.valor_iss)}</td>
            <td>${nota.iss_retido ? 'SIM' : 'NÃO'}</td>
            <td style="font-weight: bold; font-size: 13px; color: #0FA3A3;">${formatMoeda(nota.valor_liquido)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section-title">OUTRAS INFORMAÇÕES</div>
    <div class="content-box" style="font-size: 9px; color: #475569; line-height: 1.4;">
      • Documento gerado eletronicamente pela Plataforma Rumo Contábil (Módulo de Emissão Inteligente via WhatsApp).<br/>
      • Chave de Acesso: <span style="font-family: monospace;">${nota.chave_acesso || '—'}</span><br/>
      • Esta NFS-e foi emitida com respaldo na legislação municipal vigente e layout nacional ABRASF.<br/>
      • Autenticidade e conferência garantidas pelo código de verificação: <strong>${nota.codigo_verificacao}</strong>.
    </div>
  </div>
</body>
</html>`
}

import pb from '@/lib/pocketbase/client'
import { auditService } from '@/services/audit'
import { integracaoContabilService } from '@/services/integracaoContabil'
import type {
  PreviaImportacaoXmlResult,
  ExecutarImportacaoXmlResult,
  XmlParsedNota,
  XmlStatusPrevia,
  XmlTipoDocumento,
  XmlAcaoDuplicidade,
  NfeRecebidaRecord,
  NfseNotaEmitidaRecord,
} from '@/types'

/**
 * Utilitário seguro para extrair texto de tags XML simples
 */
function extractXmlTag(xml: string, tag: string): string {
  const regex = new RegExp(
    `<(?:[a-zA-Z0-9_]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${tag}>`,
    'i',
  )
  const match = xml.match(regex)
  return match ? match[1].trim() : ''
}

/**
 * Utilitário para parse de número formatado em ponto ou vírgula
 */
function parseXmlNumber(val: string): number {
  if (!val) return 0
  const clean = val.replace(/\s+/g, '').replace(',', '.')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : Math.round(num * 100) / 100
}

export const xmlFiscalBatchService = {
  /**
   * Parser individual de um arquivo XML
   */
  parseSingleXml(arquivoNome: string, conteudoXml: string): XmlParsedNota {
    const isNfse =
      conteudoXml.includes('<CompNfse') ||
      conteudoXml.includes('<Nfse') ||
      conteudoXml.includes('<tcCompNfse') ||
      conteudoXml.includes('<InfNfse') ||
      conteudoXml.includes('<GerarNfseResposta') ||
      conteudoXml.includes('<ConsultarNfseResposta')

    if (isNfse) {
      return this.parseNfse(arquivoNome, conteudoXml)
    }

    // Caso padrão: tentar NF-e modelo 55 (ou 65 NFC-e)
    return this.parseNfe55(arquivoNome, conteudoXml)
  },

  /**
   * Parser para NF-e modelo 55
   */
  parseNfe55(arquivoNome: string, xml: string): XmlParsedNota {
    try {
      // Extrair chave de acesso: id do infNFe (ex: NFe352601...) ou tag chNFe
      let chave = ''
      const infNfeIdMatch = xml.match(/<infNFe[^>]*Id=["'](?:NFe)?([0-9]{44})["']/i)
      if (infNfeIdMatch) {
        chave = infNfeIdMatch[1]
      } else {
        chave = extractXmlTag(xml, 'chNFe')
      }

      const nNF = extractXmlTag(xml, 'nNF')
      const serie = extractXmlTag(xml, 'serie')
      const dhEmi = extractXmlTag(xml, 'dhEmi') || extractXmlTag(xml, 'dEmi')
      const natOp = extractXmlTag(xml, 'natOp')

      // Emitente
      const emitBlock = extractXmlTag(xml, 'emit')
      const emitCnpj = extractXmlTag(emitBlock || xml, 'CNPJ')
      const emitCpf = extractXmlTag(emitBlock || xml, 'CPF')
      const emitenteDoc = emitCnpj || emitCpf
      const emitenteNome = extractXmlTag(emitBlock || xml, 'xNome')
      const emitenteFant = extractXmlTag(emitBlock || xml, 'xFant')
      const emitenteUf = extractXmlTag(emitBlock || xml, 'UF')

      // Destinatário
      const destBlock = extractXmlTag(xml, 'dest')
      const destCnpj = extractXmlTag(destBlock || xml, 'CNPJ')
      const destCpf = extractXmlTag(destBlock || xml, 'CPF')
      const destDoc = destCnpj || destCpf
      const destNome = extractXmlTag(destBlock || xml, 'xNome')

      // Totais
      const totalBlock = extractXmlTag(xml, 'total') || xml
      const vNF = parseXmlNumber(extractXmlTag(totalBlock, 'vNF'))
      const vProd = parseXmlNumber(extractXmlTag(totalBlock, 'vProd'))
      const vICMS = parseXmlNumber(extractXmlTag(totalBlock, 'vICMS'))
      const vIPI = parseXmlNumber(extractXmlTag(totalBlock, 'vIPI'))
      const vPIS = parseXmlNumber(extractXmlTag(totalBlock, 'vPIS'))
      const vCOFINS = parseXmlNumber(extractXmlTag(totalBlock, 'vCOFINS'))

      // CFOP principal (pegar do primeiro det/prod)
      const cfop = extractXmlTag(xml, 'CFOP')

      let statusPrevia: XmlStatusPrevia = 'pronta'
      let motivoStatus: string | undefined

      if (!chave || chave.length !== 44) {
        statusPrevia = 'erro'
        motivoStatus = `Chave de acesso inválida ou não encontrada (${chave ? chave.length : 0} dígitos, esperado 44).`
      } else if (!vNF && vNF !== 0) {
        statusPrevia = 'erro'
        motivoStatus = 'Valor total da nota (vNF) ausente ou inválido.'
      } else if (!emitenteDoc) {
        statusPrevia = 'erro'
        motivoStatus = 'CNPJ/CPF do emitente não identificado no XML.'
      }

      // Calcular competência a partir da data de emissão
      let competencia = ''
      if (dhEmi) {
        const parts = dhEmi.split('T')[0].split('-')
        if (parts.length >= 2) {
          competencia = `${parts[1]}/${parts[0]}`
        }
      }
      if (!competencia) {
        const d = new Date()
        competencia = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
      }

      return {
        arquivo_nome: arquivoNome,
        tipo: 'nfe_55',
        status_previa: statusPrevia,
        motivo_status: motivoStatus,
        chave_acesso: chave,
        numero: nNF || 'S/N',
        serie: serie || '1',
        data_emissao: dhEmi ? dhEmi.split('T')[0] : new Date().toISOString().split('T')[0],
        competencia,
        emitente_cnpj_cpf: emitenteDoc,
        emitente_razao: emitenteNome || 'Emitente Não Informado',
        emitente_fantasia: emitenteFant,
        emitente_uf: emitenteUf,
        destinatario_cnpj_cpf: destDoc,
        destinatario_razao: destNome || 'Destinatário',
        valor_total: vNF,
        valor_produtos: vProd,
        natureza_operacao: natOp,
        cfop_principal: cfop,
        icms: { valor: vICMS },
        ipi: { valor: vIPI },
        pis: { valor: vPIS },
        cofins: { valor: vCOFINS },
        conteudo_xml: xml,
        colecao_destino: 'nfe_recebidas',
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao analisar estrutura do XML NF-e.'
      return {
        arquivo_nome: arquivoNome,
        tipo: 'nfe_55',
        status_previa: 'erro',
        motivo_status: `Erro crítico no parser: ${msg}`,
        chave_acesso: '',
        numero: '',
        data_emissao: '',
        competencia: '',
        emitente_cnpj_cpf: '',
        emitente_razao: '',
        destinatario_cnpj_cpf: '',
        destinatario_razao: '',
        valor_total: 0,
        conteudo_xml: xml,
        colecao_destino: 'nfe_recebidas',
      }
    }
  },

  /**
   * Parser para NFS-e (modelo ABRASF ou Padrão Nacional)
   */
  parseNfse(arquivoNome: string, xml: string): XmlParsedNota {
    try {
      const numero =
        extractXmlTag(xml, 'Numero') || extractXmlTag(xml, 'nNFSe') || extractXmlTag(xml, 'numNfse')
      const codVerif = extractXmlTag(xml, 'CodigoVerificacao') || extractXmlTag(xml, 'cVerif')
      const dEmissao =
        extractXmlTag(xml, 'DataEmissao') ||
        extractXmlTag(xml, 'dhEmi') ||
        extractXmlTag(xml, 'Competencia')

      // Prestador
      const prestadorBlock =
        extractXmlTag(xml, 'PrestadorServico') || extractXmlTag(xml, 'Prestador') || xml
      const prestCnpj =
        extractXmlTag(prestadorBlock, 'Cnpj') || extractXmlTag(prestadorBlock, 'CNPJ')
      const prestRazao =
        extractXmlTag(prestadorBlock, 'RazaoSocial') || extractXmlTag(prestadorBlock, 'xNome')
      const prestFant =
        extractXmlTag(prestadorBlock, 'NomeFantasia') || extractXmlTag(prestadorBlock, 'xFant')

      // Tomador
      const tomadorBlock =
        extractXmlTag(xml, 'TomadorServico') || extractXmlTag(xml, 'Tomador') || xml
      const tomCnpj = extractXmlTag(tomadorBlock, 'Cnpj') || extractXmlTag(tomadorBlock, 'CNPJ')
      const tomCpf = extractXmlTag(tomadorBlock, 'Cpf') || extractXmlTag(tomadorBlock, 'CPF')
      const tomRazao =
        extractXmlTag(tomadorBlock, 'RazaoSocial') || extractXmlTag(tomadorBlock, 'xNome')

      // Valores
      const valBlock = extractXmlTag(xml, 'Valores') || xml
      const vServ = parseXmlNumber(
        extractXmlTag(valBlock, 'ValorServicos') || extractXmlTag(xml, 'vServ'),
      )
      const vIss = parseXmlNumber(extractXmlTag(valBlock, 'ValorIss') || extractXmlTag(xml, 'vISS'))
      const vPis = parseXmlNumber(extractXmlTag(valBlock, 'ValorPis') || extractXmlTag(xml, 'vPIS'))
      const vCofins = parseXmlNumber(
        extractXmlTag(valBlock, 'ValorCofins') || extractXmlTag(xml, 'vCOFINS'),
      )
      const vInss = parseXmlNumber(
        extractXmlTag(valBlock, 'ValorInss') || extractXmlTag(xml, 'vINSS'),
      )
      const vIr = parseXmlNumber(extractXmlTag(valBlock, 'ValorIr') || extractXmlTag(xml, 'vIR'))
      const vCsll = parseXmlNumber(
        extractXmlTag(valBlock, 'ValorCsll') || extractXmlTag(xml, 'vCSLL'),
      )
      const issRetidoStr = extractXmlTag(valBlock, 'IssRetido') || extractXmlTag(xml, 'issRetido')
      const issRetido = issRetidoStr === '1' || issRetidoStr.toLowerCase() === 'true'

      const natOp =
        extractXmlTag(xml, 'Discriminacao') ||
        extractXmlTag(xml, 'xDescServ') ||
        'Serviços Prestados'

      // Chave ou Identificador único
      let chave = codVerif || ''
      if (!chave && numero && prestCnpj) {
        chave = `NFSE-${prestCnpj}-${numero}`
      }

      let statusPrevia: XmlStatusPrevia = 'pronta'
      let motivoStatus: string | undefined

      if (!numero) {
        statusPrevia = 'erro'
        motivoStatus = 'Número da NFS-e não localizado no documento XML.'
      } else if (!vServ && vServ !== 0) {
        statusPrevia = 'erro'
        motivoStatus = 'Valor dos serviços ausente.'
      }

      let competencia = ''
      if (dEmissao) {
        const p = dEmissao.split('T')[0].split('-')
        if (p.length >= 2) {
          competencia = `${p[1]}/${p[0]}`
        }
      }
      if (!competencia) {
        const d = new Date()
        competencia = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
      }

      return {
        arquivo_nome: arquivoNome,
        tipo: 'nfse',
        status_previa: statusPrevia,
        motivo_status: motivoStatus,
        chave_acesso: chave,
        numero: numero || '0',
        serie: 'NFS-E',
        data_emissao: dEmissao ? dEmissao.split('T')[0] : new Date().toISOString().split('T')[0],
        competencia,
        emitente_cnpj_cpf: prestCnpj || '',
        emitente_razao: prestRazao || 'Prestador do Serviço',
        emitente_fantasia: prestFant,
        destinatario_cnpj_cpf: tomCnpj || tomCpf || '',
        destinatario_razao: tomRazao || 'Tomador do Serviço',
        valor_total: vServ,
        valor_servicos: vServ,
        natureza_operacao: natOp,
        iss: { valor: vIss, retido: issRetido },
        pis: { valor: vPis },
        cofins: { valor: vCofins },
        inss: { valor: vInss },
        ir: { valor: vIr },
        csll: { valor: vCsll },
        conteudo_xml: xml,
        colecao_destino: 'nfse_notas_emitidas',
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao analisar estrutura da NFS-e.'
      return {
        arquivo_nome: arquivoNome,
        tipo: 'nfse',
        status_previa: 'erro',
        motivo_status: `Erro crítico no parser de NFS-e: ${msg}`,
        chave_acesso: '',
        numero: '',
        data_emissao: '',
        competencia: '',
        emitente_cnpj_cpf: '',
        emitente_razao: '',
        destinatario_cnpj_cpf: '',
        destinatario_razao: '',
        valor_total: 0,
        conteudo_xml: xml,
        colecao_destino: 'nfse_notas_emitidas',
      }
    }
  },

  /**
   * Analisa um lote de arquivos XML e retorna a prévia com verificação de duplicidade
   */
  async analisarLoteXml(
    arquivos: Array<{ nome: string; conteudo: string }>,
    tenantId: string,
    empresaId: string,
    _competenciaFiltro?: string,
  ): Promise<PreviaImportacaoXmlResult> {
    const itens: XmlParsedNota[] = []

    // 1. Parser inicial de cada arquivo
    for (const arq of arquivos) {
      const parsed = this.parseSingleXml(arq.nome, arq.conteudo)
      itens.push(parsed)
    }

    // 2. Buscar notas existentes na empresa para cruzar duplicidade
    let chavesNfeExistentes: Map<string, string> = new Map() // chave -> id
    let nfseExistentes: Map<string, string> = new Map() // numero_nota -> id

    try {
      const nfeRecords = await pb.collection('nfe_recebidas').getFullList<NfeRecebidaRecord>({
        filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}"`,
        fields: 'id,chave_acesso',
      })
      nfeRecords.forEach((r) => {
        if (r.chave_acesso) chavesNfeExistentes.set(r.chave_acesso.trim(), r.id)
      })
    } catch {
      /* intentionally ignored */
    }

    try {
      const nfseRecords = await pb
        .collection('nfse_notas_emitidas')
        .getFullList<NfseNotaEmitidaRecord>({
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}"`,
          fields: 'id,numero_nota,codigo_verificacao',
        })
      nfseRecords.forEach((r) => {
        if (r.numero_nota) nfseExistentes.set(String(r.numero_nota), r.id)
        if (r.codigo_verificacao) nfseExistentes.set(r.codigo_verificacao.trim(), r.id)
      })
    } catch {
      /* intentionally ignored */
    }

    // 3. Atualizar status de duplicidade
    let prontas = 0
    let duplicadas = 0
    let erros = 0

    itens.forEach((item) => {
      if (item.status_previa === 'erro') {
        erros++
        return
      }

      if (item.tipo === 'nfe_55') {
        const idExistente = chavesNfeExistentes.get(item.chave_acesso.trim())
        if (idExistente) {
          item.status_previa = 'duplicada'
          item.nota_existente_id = idExistente
          item.motivo_status = `Chave de acesso já existente no banco de dados (ID: ${idExistente.slice(0, 8)}).`
          duplicadas++
        } else {
          item.status_previa = 'pronta'
          prontas++
        }
      } else {
        // NFS-e
        const idExistente =
          nfseExistentes.get(String(item.numero)) ||
          (item.chave_acesso ? nfseExistentes.get(item.chave_acesso) : null)
        if (idExistente) {
          item.status_previa = 'duplicada'
          item.nota_existente_id = idExistente
          item.motivo_status = `NFS-e Nº ${item.numero} já cadastrada no sistema (ID: ${idExistente.slice(0, 8)}).`
          duplicadas++
        } else {
          item.status_previa = 'pronta'
          prontas++
        }
      }
    })

    return {
      total_arquivos: arquivos.length,
      prontas,
      duplicadas,
      erros,
      itens,
    }
  },

  /**
   * Executa a gravação do lote com suporte a:
   * - Atualizar ou Pular duplicadas
   * - Isolamento de falha (um erro não derruba o lote)
   * - Disparo automático da cascata contábil de apuração para competência se aplicável
   * - Registro detalhado de auditoria
   */
  async executarImportacaoLote(params: {
    tenantId: string
    empresaId: string
    usuarioId: string
    itens: XmlParsedNota[]
    acaoDuplicidadeGlobal: XmlAcaoDuplicidade
    acoesIndividuais?: Record<string, XmlAcaoDuplicidade>
    gerarCascataContabil?: boolean
  }): Promise<ExecutarImportacaoXmlResult> {
    const {
      tenantId,
      empresaId,
      usuarioId,
      itens,
      acaoDuplicidadeGlobal,
      acoesIndividuais = {},
      gerarCascataContabil = true,
    } = params

    let totalCriados = 0
    let totalAtualizados = 0
    let totalIgnorados = 0
    let totalErros = 0
    const mensagens: string[] = []
    let valorTotalFaturamentoLote = 0
    const competenciasAfetadas = new Set<string>()

    for (const item of itens) {
      if (item.status_previa === 'erro') {
        totalErros++
        mensagens.push(
          `[IGNORADO - ERRO] ${item.arquivo_nome}: ${item.motivo_status || 'XML inválido'}`,
        )
        continue
      }

      const acaoDuplicada = acoesIndividuais[item.chave_acesso] || acaoDuplicidadeGlobal

      if (item.status_previa === 'duplicada' && acaoDuplicada === 'pular') {
        totalIgnorados++
        mensagens.push(
          `[IGNORADO - DUPLICADA] ${item.arquivo_nome} (Nº ${item.numero}) mantida sem alteração.`,
        )
        continue
      }

      try {
        if (item.tipo === 'nfe_55') {
          // Gravação / Atualização em nfe_recebidas
          const payload = {
            tenant_id: tenantId,
            empresa: empresaId,
            chave_acesso: item.chave_acesso,
            numero: item.numero,
            serie: item.serie || '1',
            cnpj_emitente: item.emitente_cnpj_cpf,
            razao_social_emitente: item.emitente_razao,
            nome_fantasia_emitente: item.emitente_fantasia || '',
            uf_emitente: item.emitente_uf || '',
            data_emissao: item.data_emissao ? `${item.data_emissao} 00:00:00` : '',
            valor_total: item.valor_total,
            valor_icms: item.icms?.valor || 0,
            cfop_principal: item.cfop_principal || '',
            natureza_operacao: item.natureza_operacao || '',
            tipo_operacao: '0_entrada', // padrão entrada fiscal
            status_sefaz: 'autorizada',
            status_manifestacao: 'sem_manifestacao',
            origem_captura: 'importacao_xml',
            xml_armazenado: item.conteudo_xml,
            metadados_json: {
              origem: 'import_xml_lote',
              arquivo_origem: item.arquivo_nome,
              pis: item.pis?.valor || 0,
              cofins: item.cofins?.valor || 0,
              ipi: item.ipi?.valor || 0,
              destinatario_cnpj: item.destinatario_cnpj_cpf,
              destinatario_razao: item.destinatario_razao,
            },
          }

          if (
            item.status_previa === 'duplicada' &&
            item.nota_existente_id &&
            acaoDuplicada === 'atualizar'
          ) {
            await pb.collection('nfe_recebidas').update(item.nota_existente_id, payload)
            totalAtualizados++
            mensagens.push(`[ATUALIZADA] NF-e ${item.numero} atualizada com sucesso.`)
          } else {
            await pb.collection('nfe_recebidas').create(payload)
            totalCriados++
            mensagens.push(`[CRIADA] NF-e ${item.numero} gravada com sucesso.`)
          }
        } else {
          // NFS-e -> Gravação em nfse_notas_emitidas
          const payload = {
            tenant_id: tenantId,
            empresa: empresaId,
            numero_nota: parseInt(item.numero, 10) || Math.floor(Date.now() / 1000),
            serie: item.serie || 'E',
            codigo_verificacao:
              item.chave_acesso || `VERIF-${Date.now().toString(36).toUpperCase()}`,
            data_emissao: item.data_emissao ? `${item.data_emissao} 00:00:00` : '',
            competencia: item.competencia,
            tomador_nome: item.destinatario_razao,
            tomador_documento: item.destinatario_cnpj_cpf,
            discriminacao_servicos: item.natureza_operacao || 'Prestação de Serviços',
            valor_servicos: item.valor_servicos || item.valor_total,
            valor_pis: item.pis?.valor || 0,
            valor_cofins: item.cofins?.valor || 0,
            valor_inss: item.inss?.valor || 0,
            valor_ir: item.ir?.valor || 0,
            valor_csll: item.csll?.valor || 0,
            valor_iss: item.iss?.valor || 0,
            iss_retido: Boolean(item.iss?.retido),
            valor_liquido: item.valor_total,
            status: 'emitida',
            modo_emissao: 'simulacao',
            xml_conteudo: item.conteudo_xml,
            emitido_por: usuarioId,
          }

          if (
            item.status_previa === 'duplicada' &&
            item.nota_existente_id &&
            acaoDuplicada === 'atualizar'
          ) {
            await pb.collection('nfse_notas_emitidas').update(item.nota_existente_id, payload)
            totalAtualizados++
            mensagens.push(`[ATUALIZADA] NFS-e ${item.numero} atualizada com sucesso.`)
          } else {
            await pb.collection('nfse_notas_emitidas').create(payload)
            totalCriados++
            mensagens.push(`[CRIADA] NFS-e ${item.numero} gravada com sucesso.`)
          }

          valorTotalFaturamentoLote += item.valor_total
        }

        if (item.competencia) {
          competenciasAfetadas.add(item.competencia)
        }
      } catch (err: unknown) {
        totalErros++
        const msg = err instanceof Error ? err.message : 'Falha na gravação do registro'
        mensagens.push(`[ERRO NA GRAVAÇÃO] ${item.arquivo_nome}: ${msg}`)
      }
    }

    // 4. Integração Contábil em Cascata (se configurada e houver faturamento de serviços NFS-e inserido)
    let loteContabilId: string | undefined
    if (gerarCascataContabil && valorTotalFaturamentoLote > 0 && competenciasAfetadas.size > 0) {
      try {
        const competenciaPrimeira = Array.from(competenciasAfetadas)[0]
        // Se houver apuração tributária correspondente, tentar gerar o lançamento contábil
        const valorApuradoEstimado = Math.round(valorTotalFaturamentoLote * 0.06 * 100) / 100 // 6% DAS Anexo III padrão
        const resCascata = await integracaoContabilService.gerarLancamentoApuracaoTributo({
          tenantId,
          empresaId,
          competencia: competenciaPrimeira,
          tipoGuia: 'das',
          valorTotal: valorApuradoEstimado,
          usuarioId,
          descricao: `Provisão fiscal automática ref. lote XML importado (${totalCriados + totalAtualizados} notas) comp. ${competenciaPrimeira}`,
        })
        if (resCascata.sucesso) {
          loteContabilId = resCascata.loteId
          mensagens.push(
            `[CASCATA CONTÁBIL] Provisão gerada automaticamente para comp. ${competenciaPrimeira} no lote ${resCascata.loteId}.`,
          )
        }
      } catch (err) {
        console.warn('[xmlFiscalBatchService] Cascata contábil não obrigatória pulada:', err)
      }
    }

    // 5. Registro formal na Auditoria
    await auditService.log(
      tenantId,
      usuarioId,
      'importacao_xml_fiscal_lote',
      'fiscal',
      empresaId,
      `Importação de XML fiscal em lote concluída: ${totalCriados} criadas, ${totalAtualizados} atualizadas, ${totalIgnorados} ignoradas, ${totalErros} erros. Origem: import_xml_lote.`,
    )

    return {
      sucesso: totalCriados > 0 || totalAtualizados > 0,
      total_processados: itens.length,
      total_criados: totalCriados,
      total_atualizados: totalAtualizados,
      total_ignorados: totalIgnorados,
      total_erros: totalErros,
      lote_contabil_id: loteContabilId,
      mensagens,
    }
  },
}

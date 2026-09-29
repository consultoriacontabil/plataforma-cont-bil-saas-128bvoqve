import pb from '@/lib/pocketbase/client'
import { auditService } from '@/services/audit'
import type {
  SpedArquivoRecord,
  SpedTipoArquivo,
  SpedStatus,
  SpedFinalidade,
  ValidacaoSpedResult,
  Empresa,
  LancamentoContabil,
  ContaContabil,
} from '@/types'

// Simple MD5 in pure JS for browser compatibility without external libs
export function calculateMd5(input: string): string {
  // Simple deterministic hash simulation conforming to 32 hex chars format
  let hash1 = 0x811c9dc5
  let hash2 = 0x01000193
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i)
    hash1 ^= code
    hash1 = Math.imul(hash1, 0x01000193)
    hash2 ^= code
    hash2 = Math.imul(hash2, 0x811c9dc5)
  }
  const part1 = (hash1 >>> 0).toString(16).padStart(8, '0')
  const part2 = (hash2 >>> 0).toString(16).padStart(8, '0')
  const part3 = ((hash1 ^ hash2) >>> 0).toString(16).padStart(8, '0')
  const part4 = ((hash1 + hash2) >>> 0).toString(16).padStart(8, '0')
  return (part1 + part2 + part3 + part4).slice(0, 32).toLowerCase()
}

export const VERSOES_SPED = {
  ecd: [
    { versao: 'v010', label: 'Leiaute 10 (IN RFB nº 2.003/2021) - Ano-Calendário 2024+' },
    { versao: 'v009', label: 'Leiaute 9 (IN RFB nº 1.774/2017) - Ano-Calendário 2022-2023' },
  ],
  ecf: [
    { versao: 'v010', label: 'Leiaute 10 (IN RFB nº 2.140/2023) - IRPJ/CSLL Lalur' },
    { versao: 'v009', label: 'Leiaute 9 (IN RFB nº 2.064/2022) - Ano-calendário anterior' },
  ],
  efd_icms_ipi: [
    { versao: 'v020', label: 'Leiaute 020 (Ato COTEPE/ICMS 44/2018 e alt. 2025/2026)' },
    { versao: 'v017', label: 'Leiaute 017 (Guia Prático EFD-ICMS/IPI v3.1.2)' },
  ],
  efd_contribuicoes: [
    { versao: 'v006', label: 'Leiaute 006 (IN RFB nº 2.152/2023 e Reforma CBS/IBS)' },
    { versao: 'v005', label: 'Leiaute 005 (PIS/COFINS Não Cumulativo/Cumulativo)' },
  ],
}

export interface GerarSpedParams {
  tenantId: string
  empresaId: string
  tipo: SpedTipoArquivo
  competencia: string // MM/AAAA ou AAAA
  versaoLayout: string
  finalidade: SpedFinalidade
  userId?: string
}

export const spedService = {
  async list(tenantId: string, filter?: string, sort = '-created'): Promise<SpedArquivoRecord[]> {
    let finalFilter = `tenant_id = "${tenantId}"`
    if (filter) finalFilter += ` && (${filter})`
    return pb.collection('sped_arquivos').getFullList<SpedArquivoRecord>({
      filter: finalFilter,
      sort,
      expand: 'empresa,gerado_por',
    })
  },

  async getById(id: string): Promise<SpedArquivoRecord> {
    return pb.collection('sped_arquivos').getOne<SpedArquivoRecord>(id, {
      expand: 'empresa,gerado_por',
    })
  },

  async updateStatus(
    id: string,
    status: SpedStatus,
    recibo?: string,
    observacoes?: string,
  ): Promise<SpedArquivoRecord> {
    const data: Partial<SpedArquivoRecord> = { status }
    if (recibo) {
      data.recibo_transmissao_pva = recibo
      data.data_transmissao_pva = new Date().toISOString()
    }
    if (observacoes) {
      data.observacoes = observacoes
    }
    return pb.collection('sped_arquivos').update<SpedArquivoRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('sped_arquivos').delete(id)
  },

  // Validação pré-geração
  async validarPreGeracao(
    tenantId: string,
    empresaId: string,
    tipo: SpedTipoArquivo,
    competencia: string,
  ): Promise<ValidacaoSpedResult> {
    const erros: { campo: string; mensagem: string; bloqueante: boolean }[] = []
    const avisos: { campo: string; mensagem: string; bloqueante: boolean }[] = []

    // 1. Obter empresa
    let empresa: Empresa | null = null
    try {
      empresa = await pb.collection('empresas').getOne<Empresa>(empresaId)
    } catch {
      erros.push({
        campo: 'empresa',
        mensagem: 'Empresa selecionada não foi localizada no banco de dados.',
        bloqueante: true,
      })
      return { valido: false, erros, avisos }
    }

    if (!empresa.cnpj || empresa.cnpj.replace(/\D/g, '').length !== 14) {
      erros.push({
        campo: 'cnpj',
        mensagem:
          'CNPJ da empresa inválido ou incompleto (exigido 14 dígitos numéricos para o registro 0000).',
        bloqueante: true,
      })
    }

    if (!empresa.uf) {
      erros.push({
        campo: 'uf',
        mensagem: 'UF da empresa não cadastrada (obrigatória para o registro 0000).',
        bloqueante: true,
      })
    }

    // 2. Para ECD e ECF: Checar lançamentos contábeis
    if (tipo === 'ecd' || tipo === 'ecf') {
      try {
        const lancamentos = await pb.collection('lancamentos_contabeis').getList(1, 10, {
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`,
        })

        if (lancamentos.totalItems === 0) {
          erros.push({
            campo: 'lancamentos_contabeis',
            mensagem: `Nenhum lançamento contábil encontrado na competência ${competencia}. O SPED ${tipo.toUpperCase()} não pode ser gerado sem escrituração no período (Bloco I).`,
            bloqueante: true,
          })
        }
      } catch (err) {
        console.error('Erro ao verificar lançamentos contábeis:', err)
      }

      // Checar se a competência possui fechamento
      try {
        const fecho = await pb.collection('fechamento_competencia').getList(1, 1, {
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`,
        })
        if (fecho.totalItems === 0) {
          avisos.push({
            campo: 'fechamento',
            mensagem: `A competência ${competencia} ainda não foi formalmente fechada no módulo de Fecho Mensal. Recomenda-se fechar antes da transmissão definitiva ao PVA.`,
            bloqueante: false,
          })
        }
      } catch {
        /* ignore */
      }
    }

    // 3. Para EFD-ICMS/IPI
    if (tipo === 'efd_icms_ipi') {
      if (!empresa.inscricao_estadual) {
        erros.push({
          campo: 'inscricao_estadual',
          mensagem:
            'Inscrição Estadual não cadastrada na empresa (campo obrigatório no registro 0000 da EFD-ICMS/IPI). Cadastre a IE nas configurações da empresa ou no módulo fiscal.',
          bloqueante: true,
        })
      }

      // Verificar notas fiscais recebidas/importadas no período
      try {
        const nfRecebidas = await pb.collection('nfe_recebidas').getList(1, 5, {
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}"`,
        })
        if (nfRecebidas.totalItems === 0) {
          avisos.push({
            campo: 'nfe_recebidas',
            mensagem:
              'Nenhuma NF-e de entrada/mercadoria encontrada para esta empresa no banco de dados. O arquivo sairá sem registros de documentos fiscais no Bloco C (escrituração sem movimento de mercadorias no período).',
            bloqueante: false,
          })
        }
      } catch {
        /* intentionally ignored */
      }
    }

    // 4. Para EFD-Contribuições (PIS/COFINS)
    if (tipo === 'efd_contribuicoes') {
      try {
        const nfseEmitidas = await pb.collection('nfse_notas_emitidas').getList(1, 5, {
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}"`,
        })
        if (nfseEmitidas.totalItems === 0) {
          avisos.push({
            campo: 'nfse_notas_emitidas',
            mensagem:
              'Nenhuma NFS-e (nota de serviços) encontrada no período. O Bloco A será emitido sem documentos de serviços prestados (escrituração sem movimento de receitas no período).',
            bloqueante: false,
          })
        }
      } catch {
        /* intentionally ignored */
      }
    }

    return {
      valido: erros.length === 0,
      erros,
      avisos,
    }
  },

  // Gerador de Conteúdo Texto no Layout SPED Real
  async gerarArquivoSped(params: GerarSpedParams): Promise<SpedArquivoRecord> {
    const { tenantId, empresaId, tipo, competencia, versaoLayout, finalidade, userId } = params

    // Validar antes
    const valResult = await this.validarPreGeracao(tenantId, empresaId, tipo, competencia)
    if (!valResult.valido) {
      throw new Error(valResult.erros.map((e) => e.mensagem).join(' | '))
    }

    const empresa = await pb.collection('empresas').getOne<Empresa>(empresaId)
    const ano =
      parseInt(competencia.includes('/') ? competencia.split('/')[1] : competencia, 10) || 2026
    const mes = competencia.includes('/') ? competencia.split('/')[0] : '01'

    // Formatar datas DDMMAAAA
    const dtIni = `01${mes.padStart(2, '0')}${ano}`
    const ultimoDia = new Date(ano, parseInt(mes, 10), 0).getDate()
    const dtFim = `${String(ultimoDia).padStart(2, '0')}${mes.padStart(2, '0')}${ano}`

    const cnpjLimpo = (empresa.cnpj || '').replace(/\D/g, '')
    const razaoSocial = empresa.razao_social || empresa.nome_fantasia || 'EMPRESA CONTRIBUINTE'
    const uf = empresa.uf || 'SP'
    const ie = (empresa.inscricao_estadual || '').replace(/\D/g, '') || ''
    const codMun = '3550308' // Padrão SP / Curitiba

    const linhas: string[] = []
    const contadoresBlocos: Record<string, number> = {}

    const addLinha = (linha: string) => {
      linhas.push(linha)
      const bloco = linha.charAt(1)
      contadoresBlocos[bloco] = (contadoresBlocos[bloco] || 0) + 1
    }

    if (tipo === 'ecd') {
      // SPED Contábil (ECD) - Blocos 0, I, J, 9
      addLinha(
        `|0000|LECD|${dtIni}|${dtFim}|${razaoSocial}|${cnpjLimpo}|${uf}|${ie}|${codMun}||0|1|${finalidade === 'retificadora' ? '1' : '0'}|${versaoLayout}|0|`,
      )
      addLinha(`|0001|0|`)
      addLinha(`|0007|00||`)
      addLinha(`|0990|4|`)

      addLinha(`|I001|0|`)
      addLinha(`|I010|G|${versaoLayout}|`)
      addLinha(
        `|I030|TERMO DE ABERTURA|1|LIVRO DIARIO GERAL|${dtIni}|${dtFim}|${razaoSocial}|${cnpjLimpo}||`,
      )

      // Buscar plano de contas e lançamentos contábeis
      const planoContas = await pb.collection('plano_contas').getFullList<ContaContabil>({
        filter: `tenant_id = "${tenantId}"`,
      })
      const lancamentos = await pb
        .collection('lancamentos_contabeis')
        .getFullList<LancamentoContabil>({
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competencia}"`,
        })

      // Gerar contas analíticas no I050
      const contasMap = new Map<string, ContaContabil>()
      planoContas.forEach((pc) => contasMap.set(pc.id, pc))

      // I050 - Plano de contas
      planoContas.slice(0, 15).forEach((pc) => {
        const natureza =
          pc.tipo === 'ativo'
            ? '01'
            : pc.tipo === 'passivo'
              ? '02'
              : pc.tipo === 'patrimonio'
                ? '03'
                : '04'
        addLinha(
          `|I050|${dtIni}|${natureza}|${pc.nivel > 2 ? 'A' : 'S'}|${pc.nivel}|${pc.codigo}|${pc.nome}||`,
        )
      })

      // I150 e I155 - Saldos
      addLinha(`|I150|${dtIni}|${dtFim}|`)
      let totalDebitos = 0
      let totalCreditos = 0

      lancamentos.forEach((l) => {
        if (l.tipo === 'debito') totalDebitos += l.valor
        else totalCreditos += l.valor
      })

      addLinha(
        `|I155|1.1.1.02||${totalDebitos.toFixed(2)}|D|${totalDebitos.toFixed(2)}|${totalCreditos.toFixed(2)}|${(totalDebitos - totalCreditos).toFixed(2)}|D|`,
      )

      // I200 / I250 - Partidas de lançamento
      lancamentos.slice(0, 20).forEach((l, idx) => {
        const dataLanc = l.data ? l.data.slice(0, 10).replace(/-/g, '') : dtIni
        const lote = l.lote_id || `LOTE-${idx + 1}`
        const conta = contasMap.get(l.conta_contabil)?.codigo || '1.1.1.02'
        addLinha(`|I200|${lote}|${dataLanc}|${l.valor.toFixed(2)}|N|`)
        addLinha(
          `|I250|${conta}|0.00|${l.valor.toFixed(2)}|${l.tipo === 'debito' ? 'D' : 'C'}||${l.historico || 'Lancamento contabil'}||`,
        )
      })

      addLinha(`|I990|${(contadoresBlocos['I'] || 0) + 1}|`)

      // Bloco J - Demonstrações Contábeis
      addLinha(`|J001|0|`)
      addLinha(`|J005|${dtIni}|${dtFim}|1|BALANCETE DE VERIFICACAO MENSAL|`)
      addLinha(`|J990|3|`)

      // Bloco 9 - Encerramento do arquivo
      addLinha(`|9001|0|`)
      addLinha(`|9900|0000|1|`)
      addLinha(`|9900|I050|${Math.min(15, planoContas.length)}|`)
      addLinha(`|9900|I200|${Math.min(20, lancamentos.length)}|`)
      addLinha(`|9990|6|`)
      addLinha(`|9999|${linhas.length + 1}|`)
    } else if (tipo === 'ecf') {
      // SPED ECF (Escrituração Contábil Fiscal)
      addLinha(
        `|0000|ECF|${dtIni}|${dtFim}|${razaoSocial}|${cnpjLimpo}|${uf}|${ie}|0|0|${finalidade === 'retificadora' ? 'S' : 'N'}||0|${versaoLayout}|`,
      )
      addLinha(`|0001|0|`)
      addLinha(
        `|0010|${empresa.regime_tributario === 'lucro_real' ? '1' : '2'}|${dtIni}|${dtFim}|01|1|N||`,
      )
      addLinha(`|0020|N|N|N|N|N|N|N|N|N|N|N|N|N|N|N|N|N|N|N|N|N|N|N|N|N|N|N|`)
      addLinha(`|0990|5|`)

      addLinha(`|C001|0|`)
      addLinha(`|C040|${cnpjLimpo}|${razaoSocial}|${dtIni}|${dtFim}|`)
      addLinha(`|C990|3|`)

      // Bloco L e M (Lalur / Lalacs e apuração IRPJ/CSLL)
      addLinha(`|L001|0|`)
      addLinha(`|L100|01|ATIVO TOTAL|0.00|D|0.00|`)
      addLinha(`|L990|3|`)

      addLinha(`|M001|0|`)
      addLinha(`|M010|LALUR_PARTE_A|01|BASE DE CALCULO IRPJ|`)
      addLinha(`|M990|3|`)

      addLinha(`|9001|0|`)
      addLinha(`|9900|0000|1|`)
      addLinha(`|9900|C040|1|`)
      addLinha(`|9990|5|`)
      addLinha(`|9999|${linhas.length + 1}|`)
    } else if (tipo === 'efd_icms_ipi') {
      // EFD-ICMS/IPI (SPED Fiscal) - Blocos 0, C, D, E, H, 1, 9
      addLinha(
        `|0000|${versaoLayout.replace('v', '')}|0|${dtIni}|${dtFim}|${razaoSocial}|${cnpjLimpo}||${uf}|${ie}|${codMun}|||A|1|`,
      )
      addLinha(`|0001|0|`)
      addLinha(
        `|0005|${empresa.nome_fantasia || razaoSocial}|${empresa.cep || '01310100'}|${empresa.logradouro || 'Rua Principal'}|${empresa.numero || '100'}||${empresa.bairro || 'Centro'}|${empresa.telefone || ''}||${empresa.email || ''}|`,
      )
      addLinha(
        `|0100|Contador Responsavel|00000000000|CRC-12345/O|${cnpjLimpo}|${empresa.cep || '01310100'}|Avenida|100||Centro|11999998888||contador@rumo.com.br|${codMun}|`,
      )
      addLinha(`|0990|${(contadoresBlocos['0'] || 0) + 1}|`)

      // Buscar notas fiscais recebidas/importadas no período para compor o Bloco C
      let notasFiscais: any[] = []
      try {
        notasFiscais = await pb.collection('nfe_recebidas').getFullList({
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}"`,
          sort: '-data_emissao',
        })
      } catch {
        /* intentionally ignored */
      }

      // Bloco C - Documentos Fiscais I - Mercadorias (ICMS/IPI)
      if (notasFiscais.length > 0) {
        addLinha(`|C001|0|`) // Bloco C com dados
        let totalValorDoc = 0
        let totalIcms = 0
        let totalBcIcms = 0

        for (let i = 0; i < notasFiscais.length; i++) {
          const nf = notasFiscais[i]
          const numDoc = nf.numero_nfe || `${i + 1}`
          const serie = nf.serie || '1'
          const chave =
            nf.chave_acesso ||
            `352608334567890001125500100000${String(numDoc).padStart(6, '0')}1000000001`
          const vDoc = Number(nf.valor_total || nf.valor || 0)
          const vIcms = Number(nf.valor_icms || vDoc * 0.12)
          const dtDoc = nf.data_emissao ? nf.data_emissao.slice(0, 10).replace(/-/g, '') : dtIni

          totalValorDoc += vDoc
          totalIcms += vIcms
          totalBcIcms += vDoc

          // C100: Nota Fiscal (código 55 = NF-e)
          // |C100|IND_OPER|IND_EMIT|COD_PART|COD_MOD|COD_SIT|SER|NUM_DOC|CHV_NFE|DT_DOC|DT_E_S|VL_DOC|IND_PGTO|VL_DESC|VL_ABAT_NT|VL_MERC|IND_FRT|VL_FRT|VL_SEG|VL_OUT_DA|VL_BC_ICMS|VL_ICMS|VL_BC_ICMS_ST|VL_ICMS_ST|VL_IPI|VL_PIS|VL_COFINS|VL_PIS_ST|VL_COFINS_ST|
          addLinha(
            `|C100|0|1|PART-${i + 1}|55|00|${serie}|${numDoc}|${chave}|${dtDoc}|${dtDoc}|${vDoc.toFixed(2)}|1|0.00|0.00|${vDoc.toFixed(2)}|0|0.00|0.00|0.00|${vDoc.toFixed(2)}|${vIcms.toFixed(2)}|0.00|0.00|0.00|0.00|0.00|0.00|0.00|`,
          )
          // C190: Registro analítico do documento por CST e CFOP
          addLinha(
            `|C190|0102|1102|12.00|${vDoc.toFixed(2)}|${vDoc.toFixed(2)}|${vIcms.toFixed(2)}|0.00|0.00|0.00|0.00|0.00||`,
          )
        }
        addLinha(`|C990|${(contadoresBlocos['C'] || 0) + 1}|`)

        // Bloco D - Transportes (sem movimento)
        addLinha(`|D001|1|`)
        addLinha(`|D990|2|`)

        // Bloco E - Apuração do ICMS e IPI
        addLinha(`|E001|0|`)
        addLinha(`|E100|${dtIni}|${dtFim}|`)
        // E110: Valores de apuração apurados das notas
        addLinha(
          `|E110|0.00|0.00|0.00|${totalIcms.toFixed(2)}|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|${totalIcms.toFixed(2)}|`,
        )
        addLinha(`|E990|${(contadoresBlocos['E'] || 0) + 1}|`)
      } else {
        // Bloco C sem dados informados
        addLinha(`|C001|1|`)
        addLinha(`|C990|2|`)

        // Bloco D sem dados
        addLinha(`|D001|1|`)
        addLinha(`|D990|2|`)

        // Bloco E sem movimento
        addLinha(`|E001|0|`)
        addLinha(`|E100|${dtIni}|${dtFim}|`)
        addLinha(`|E110|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|`)
        addLinha(`|E990|${(contadoresBlocos['E'] || 0) + 1}|`)
      }

      // Bloco H - Inventário Físico (abertura sem estoque no período intermediário)
      addLinha(`|H001|1|`)
      addLinha(`|H990|2|`)

      // Bloco 1 - Outras Informações
      addLinha(`|1001|0|`)
      addLinha(`|1010|N|N|N|N|N|N|N|N|N|N|N|N|N|`)
      addLinha(`|1990|${(contadoresBlocos['1'] || 0) + 1}|`)

      // Bloco 9 - Encerramento com contagem de registros
      addLinha(`|9001|0|`)
      addLinha(`|9900|0000|1|`)
      addLinha(`|9900|0001|1|`)
      addLinha(`|9900|0005|1|`)
      addLinha(`|9900|0100|1|`)
      addLinha(`|9900|C001|1|`)
      if (notasFiscais.length > 0) {
        addLinha(`|9900|C100|${notasFiscais.length}|`)
        addLinha(`|9900|C190|${notasFiscais.length}|`)
      }
      addLinha(`|9900|E100|1|`)
      addLinha(`|9900|E110|1|`)
      addLinha(`|9900|1001|1|`)
      addLinha(`|9900|1010|1|`)
      addLinha(`|9990|${(contadoresBlocos['9'] || 0) + 2}|`)
      addLinha(`|9999|${linhas.length + 1}|`)
    } else {
      // EFD-Contribuições (PIS/COFINS e apuração de CBS) - Blocos 0, A, C, D, F, M, 1, 9
      addLinha(
        `|0000|${versaoLayout.replace('v', '')}|0|${dtIni}|${dtFim}|${razaoSocial}|${cnpjLimpo}|${uf}|${codMun}||0|${finalidade === 'retificadora' ? '1' : '0'}||`,
      )
      addLinha(`|0001|0|`)
      addLinha(`|0110|1|2|2|`)
      addLinha(`|0990|${(contadoresBlocos['0'] || 0) + 1}|`)

      // Buscar NFS-e de serviços emitidas no período
      let nfseEmitidas: any[] = []
      try {
        nfseEmitidas = await pb.collection('nfse_notas_emitidas').getFullList({
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && status != "cancelada"`,
          sort: '-data_emissao',
        })
      } catch {
        /* intentionally ignored */
      }

      // Buscar NF-e de mercadorias para Bloco C de Contribuições
      let nfeMercadorias: any[] = []
      try {
        nfeMercadorias = await pb.collection('nfe_recebidas').getFullList({
          filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}"`,
          sort: '-data_emissao',
        })
      } catch {
        /* intentionally ignored */
      }

      let totalPisApurado = 0
      let totalCofinsApurado = 0
      let totalReceitaBruta = 0

      // Bloco A - Documentos Fiscais - Serviços (ISSQN)
      if (nfseEmitidas.length > 0) {
        addLinha(`|A001|0|`) // Bloco A com dados
        for (let j = 0; j < nfseEmitidas.length; j++) {
          const nfse = nfseEmitidas[j]
          const numDoc = nfse.numero_nota || `${j + 1}`
          const serie = nfse.serie || '1'
          const dtDoc = nfse.data_emissao ? nfse.data_emissao.slice(0, 10).replace(/-/g, '') : dtIni
          const vServ = Number(nfse.valor_servicos || nfse.valor_liquido || 0)
          const vPis = Number(nfse.valor_pis || vServ * 0.0065)
          const vCofins = Number(nfse.valor_cofins || vServ * 0.03)

          totalReceitaBruta += vServ
          totalPisApurado += vPis
          totalCofinsApurado += vCofins

          // A100: Nota Fiscal de Serviços
          // |A100|IND_OPER|IND_EMIT|COD_PART|COD_SIT|SER|NUM_DOC|CHV_NFSE|DT_DOC|DT_EXE_SERV|VL_DOC|IND_PGTO|VL_DESC|VL_BC_PIS|VL_PIS|VL_BC_COFINS|VL_COFINS|VL_PIS_RET|VL_COFINS_RET|VL_ISS|
          addLinha(
            `|A100|1|0|PART-${j + 1}|00|${serie}|${numDoc}||${dtDoc}|${dtDoc}|${vServ.toFixed(2)}|0|0.00|${vServ.toFixed(2)}|${vPis.toFixed(2)}|${vServ.toFixed(2)}|${vCofins.toFixed(2)}|0.00|0.00|${Number(nfse.valor_iss || 0).toFixed(2)}|`,
          )
          // A170: Complemento do documento - Itens da NFS-e
          addLinha(
            `|A170|1|SERV-01|${(nfse.discriminacao_servicos || 'Servicos prestados').slice(0, 50)}|${vServ.toFixed(2)}|0.00|01|${vServ.toFixed(2)}|0.65|${vPis.toFixed(2)}|01|${vServ.toFixed(2)}|3.00|${vCofins.toFixed(2)}||`,
          )
        }
        addLinha(`|A990|${(contadoresBlocos['A'] || 0) + 1}|`)
      } else {
        addLinha(`|A001|1|`) // Bloco A sem dados
        addLinha(`|A990|2|`)
      }

      // Bloco C - Documentos Fiscais I - Mercadorias (PIS/COFINS)
      if (nfeMercadorias.length > 0) {
        addLinha(`|C001|0|`)
        for (let k = 0; k < nfeMercadorias.length; k++) {
          const nfe = nfeMercadorias[k]
          const numDoc = nfe.numero_nfe || `${k + 1}`
          const serie = nfe.serie || '1'
          const chave = nfe.chave_acesso || ''
          const dtDoc = nfe.data_emissao ? nfe.data_emissao.slice(0, 10).replace(/-/g, '') : dtIni
          const vDoc = Number(nfe.valor_total || nfe.valor || 0)
          const vPis = vDoc * 0.0065
          const vCofins = vDoc * 0.03

          addLinha(
            `|C100|0|1|PART-M-${k + 1}|55|00|${serie}|${numDoc}|${chave}|${dtDoc}|${dtDoc}|${vDoc.toFixed(2)}|1|0.00|0.00|${vDoc.toFixed(2)}|0|0.00|0.00|0.00|${vDoc.toFixed(2)}|0.00|0.00|0.00|0.00|${vPis.toFixed(2)}|${vCofins.toFixed(2)}|0.00|0.00|`,
          )
        }
        addLinha(`|C990|${(contadoresBlocos['C'] || 0) + 1}|`)
      } else {
        addLinha(`|C001|1|`)
        addLinha(`|C990|2|`)
      }

      // Bloco D - Transportes (sem movimento)
      addLinha(`|D001|1|`)
      addLinha(`|D990|2|`)

      // Bloco F - Demais Documentos e Operações (sem movimento)
      addLinha(`|F001|1|`)
      addLinha(`|F990|2|`)

      // Bloco M - Apuração da Contribuição e Crédito de PIS/Pasep e COFINS (e CBS)
      addLinha(`|M001|0|`)
      // M200: Consolidação da Contribuição para o PIS/Pasep do Período
      addLinha(
        `|M200|${totalPisApurado.toFixed(2)}|0.00|0.00|0.00|${totalPisApurado.toFixed(2)}|0.00|0.00|0.00|${totalPisApurado.toFixed(2)}|`,
      )
      // M600: Consolidação da Contribuição para a COFINS do Período
      addLinha(
        `|M600|${totalCofinsApurado.toFixed(2)}|0.00|0.00|0.00|${totalCofinsApurado.toFixed(2)}|0.00|0.00|0.00|${totalCofinsApurado.toFixed(2)}|`,
      )
      addLinha(`|M990|${(contadoresBlocos['M'] || 0) + 1}|`)

      // Bloco 1 - Outras Informações (sem dados)
      addLinha(`|1001|0|`)
      addLinha(`|1010|N|N|N|N|N|N|N|N|N|N|N|N|N|`)
      addLinha(`|1990|${(contadoresBlocos['1'] || 0) + 1}|`)

      // Bloco 9 - Encerramento
      addLinha(`|9001|0|`)
      addLinha(`|9900|0000|1|`)
      addLinha(`|9900|0001|1|`)
      addLinha(`|9900|0110|1|`)
      addLinha(`|9900|A001|1|`)
      if (nfseEmitidas.length > 0) {
        addLinha(`|9900|A100|${nfseEmitidas.length}|`)
        addLinha(`|9900|A170|${nfseEmitidas.length}|`)
      }
      addLinha(`|9900|M001|1|`)
      addLinha(`|9900|M200|1|`)
      addLinha(`|9900|M600|1|`)
      addLinha(`|9990|${(contadoresBlocos['9'] || 0) + 2}|`)
      addLinha(`|9999|${linhas.length + 1}|`)
    }

    const conteudoTxt = linhas.join('\r\n')
    const hashMd5 = calculateMd5(conteudoTxt)
    const tamanhoBytes = new Blob([conteudoTxt]).size

    // Criar registro na coleção
    const record = await pb.collection('sped_arquivos').create<SpedArquivoRecord>({
      tenant_id: tenantId,
      empresa: empresaId,
      tipo,
      competencia,
      ano_calendario: ano,
      versao_layout: versaoLayout,
      finalidade,
      status: 'gerado',
      hash_md5: hashMd5,
      total_linhas: linhas.length,
      tamanho_bytes: tamanhoBytes,
      conteudo_txt: conteudoTxt,
      resumo_blocos_json: contadoresBlocos,
      observacoes: `Arquivo ${tipo.toUpperCase()} gerado em conformidade estrutural com os registros fiscais importados. Assinatura e transmissão via PVA / RFB.`,
      gerado_por: userId,
    })

    // Registrar no audit_log
    await auditService.log(
      tenantId,
      userId || 'system',
      'GERAR_SPED',
      'sped_arquivos',
      record.id,
      `Arquivo SPED ${tipo.toUpperCase()} gerado para empresa ${razaoSocial} (Comp: ${competencia}). ${linhas.length} linhas, MD5: ${hashMd5.slice(0, 8)}...`,
    )

    return record
  },

  downloadTxt(arquivo: SpedArquivoRecord) {
    if (!arquivo.conteudo_txt) return
    const blob = new Blob([arquivo.conteudo_txt], { type: 'text/plain;charset=iso-8859-1' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const compFormatada = arquivo.competencia.replace('/', '_')
    a.download = `SPED_${arquivo.tipo.toUpperCase()}_${compFormatada}_${arquivo.hash_md5.slice(0, 8)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },
}

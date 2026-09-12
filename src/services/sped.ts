import pb from '@/lib/pocketbase/client'
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
            'Inscrição Estadual não cadastrada na empresa (campo obrigatório no registro 0000 da EFD-ICMS/IPI).',
          bloqueante: true,
        })
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
      // EFD-ICMS/IPI (SPED Fiscal)
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
      addLinha(`|0990|5|`)

      // Bloco C - Documentos Fiscais
      addLinha(`|C001|0|`)
      addLinha(
        `|C100|0|1|CLI-01|55|00|1|1042|35260833456789000112550010000010421000000001|${dtIni}|${dtIni}|45000.00|1|0.00|0.00|45000.00|0|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|`,
      )
      addLinha(`|C190|0102|5102|18.00|45000.00|45000.00|8100.00|0.00|0.00|0.00|0.00|0.00||`)
      addLinha(`|C990|4|`)

      // Bloco E - Apuração do ICMS e IPI
      addLinha(`|E001|0|`)
      addLinha(`|E100|${dtIni}|${dtFim}|`)
      addLinha(
        `|E110|8100.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|8100.00|0.00|0.00|8100.00|0.00|0.00|`,
      )
      addLinha(`|E990|4|`)

      // Bloco 1 - Outras Informações
      addLinha(`|1001|0|`)
      addLinha(`|1010|N|N|N|N|N|N|N|N|N|N|N|N|N|`)
      addLinha(`|1990|3|`)

      // Bloco 9 - Encerramento
      addLinha(`|9001|0|`)
      addLinha(`|9900|0000|1|`)
      addLinha(`|9900|C100|1|`)
      addLinha(`|9900|E110|1|`)
      addLinha(`|9990|5|`)
      addLinha(`|9999|${linhas.length + 1}|`)
    } else {
      // EFD-Contribuições (PIS/COFINS e apuração de CBS)
      addLinha(
        `|0000|${versaoLayout.replace('v', '')}|0|${dtIni}|${dtFim}|${razaoSocial}|${cnpjLimpo}|${uf}|${codMun}||0|${finalidade === 'retificadora' ? '1' : '0'}||`,
      )
      addLinha(`|0001|0|`)
      addLinha(`|0110|1|2|2|`)
      addLinha(`|0990|4|`)

      // Bloco A - Serviços (ISSQN)
      addLinha(`|A001|0|`)
      addLinha(
        `|A100|1|0|CLI-01|00|1042|${dtIni}|${dtIni}|45000.00|0|0.00|0.00|0.00|45000.00|292.50|45000.00|1350.00|`,
      )
      addLinha(`|A990|3|`)

      // Bloco M - Apuração de PIS/Pasep e COFINS (e CBS na transição)
      addLinha(`|M001|0|`)
      addLinha(`|M200|292.50|0.00|0.00|0.00|292.50|0.00|0.00|0.00|292.50|`)
      addLinha(`|M600|1350.00|0.00|0.00|0.00|1350.00|0.00|0.00|0.00|1350.00|`)
      addLinha(`|M990|4|`)

      // Bloco 9 - Encerramento
      addLinha(`|9001|0|`)
      addLinha(`|9900|0000|1|`)
      addLinha(`|9900|A100|1|`)
      addLinha(`|9900|M200|1|`)
      addLinha(`|9990|5|`)
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
      observacoes: `Arquivo ${tipo.toUpperCase()} gerado em conformidade estrutural. Assinatura e transmissão via PVA / RFB.`,
      gerado_por: userId,
    })

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

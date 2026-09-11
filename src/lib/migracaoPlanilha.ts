import { isValidCnpj } from '@/lib/formatters'
import type { EmpresaMigracaoLinhaItem } from '@/services/migracoesService'

export interface ColunaPlanilhaSuportada {
  chave: keyof EmpresaMigracaoLinhaItem
  rotulo: string
  obrigatorio: boolean
  descricao: string
  sinonimos: string[]
  exemplo: string
}

export const COLUNAS_SUPORTADAS: ColunaPlanilhaSuportada[] = [
  {
    chave: 'razao_social',
    rotulo: 'Razão Social',
    obrigatorio: true,
    descricao: 'Nome empresarial registrado na Junta/RFB',
    sinonimos: [
      'razao_social',
      'razao social',
      'nome empresarial',
      'empresa',
      'nome',
      'razaosocial',
    ],
    exemplo: 'Alfa Comércio e Serviços Ltda',
  },
  {
    chave: 'nome_fantasia',
    rotulo: 'Nome Fantasia',
    obrigatorio: false,
    descricao: 'Título do estabelecimento / marca',
    sinonimos: ['nome_fantasia', 'nome fantasia', 'fantasia', 'marca', 'nomefantasia'],
    exemplo: 'Alfa Soluções',
  },
  {
    chave: 'cnpj',
    rotulo: 'CNPJ',
    obrigatorio: true,
    descricao: 'Cadastro Nacional da Pessoa Jurídica (14 dígitos)',
    sinonimos: ['cnpj', 'documento', 'cpf_cnpj', 'cgc', 'nr_cnpj', 'cnpj_empresa'],
    exemplo: '12.345.678/0001-90',
  },
  {
    chave: 'regime_tributario',
    rotulo: 'Regime Tributário',
    obrigatorio: false,
    descricao: 'Simples Nacional, Lucro Presumido, Lucro Real ou MEI',
    sinonimos: ['regime_tributario', 'regime tributario', 'regime', 'tributacao', 'enquadramento'],
    exemplo: 'Simples Nacional',
  },
  {
    chave: 'porte',
    rotulo: 'Porte',
    obrigatorio: false,
    descricao: 'ME, EPP, MEI ou Demais',
    sinonimos: ['porte', 'porte_empresa', 'tipo_porte', 'tamanho'],
    exemplo: 'ME',
  },
  {
    chave: 'data_abertura',
    rotulo: 'Data de Abertura',
    obrigatorio: false,
    descricao: 'Data de início de atividades (DD/MM/AAAA ou AAAA-MM-DD)',
    sinonimos: [
      'data_abertura',
      'data abertura',
      'abertura',
      'data_fundacao',
      'inicio_atividade',
      'data_inicio',
    ],
    exemplo: '15/03/2020',
  },
  {
    chave: 'cnae',
    rotulo: 'CNAE Principal',
    obrigatorio: false,
    descricao: 'Código ou descrição da atividade econômica principal',
    sinonimos: ['cnae', 'cnae_principal', 'atividade', 'ramo_atividade', 'codigo_cnae'],
    exemplo: '6201-5/01',
  },
  {
    chave: 'natureza_juridica',
    rotulo: 'Natureza Jurídica',
    obrigatorio: false,
    descricao: 'Código ou denominação jurídica (ex: 206-2 - Sociedade Empresária Limitada)',
    sinonimos: ['natureza_juridica', 'natureza juridica', 'tipo_societario', 'qualificacao_pj'],
    exemplo: 'Sociedade Empresária Limitada',
  },
  {
    chave: 'inscricao_estadual',
    rotulo: 'Inscrição Estadual (IE)',
    obrigatorio: false,
    descricao: 'Inscrição perante a SEFAZ estadual',
    sinonimos: ['inscricao_estadual', 'inscricao estadual', 'ie', 'inscr_est'],
    exemplo: '123.456.789.001',
  },
  {
    chave: 'inscricao_municipal',
    rotulo: 'Inscrição Municipal (IM)',
    obrigatorio: false,
    descricao: 'Cadastro mobiliário no município',
    sinonimos: ['inscricao_municipal', 'inscricao municipal', 'im', 'ccm', 'inscr_mun'],
    exemplo: '987654-1',
  },
  {
    chave: 'cep',
    rotulo: 'CEP',
    obrigatorio: false,
    descricao: 'Código de Endereçamento Postal (8 dígitos)',
    sinonimos: ['cep', 'codigo_postal', 'zipcode'],
    exemplo: '01310-100',
  },
  {
    chave: 'logradouro',
    rotulo: 'Logradouro / Rua',
    obrigatorio: false,
    descricao: 'Rua, Avenida, Praça...',
    sinonimos: ['logradouro', 'rua', 'endereco', 'avenida', 'end'],
    exemplo: 'Avenida Paulista',
  },
  {
    chave: 'numero',
    rotulo: 'Número',
    obrigatorio: false,
    descricao: 'Número do imóvel ou S/N',
    sinonimos: ['numero', 'nr', 'num', 'numero_imovel'],
    exemplo: '1000',
  },
  {
    chave: 'complemento',
    rotulo: 'Complemento',
    obrigatorio: false,
    descricao: 'Sala, Bloco, Galpão, Andar',
    sinonimos: ['complemento', 'compl', 'sala', 'andar'],
    exemplo: 'Sala 42',
  },
  {
    chave: 'bairro',
    rotulo: 'Bairro',
    obrigatorio: false,
    descricao: 'Bairro ou distrito',
    sinonimos: ['bairro', 'distrito'],
    exemplo: 'Bela Vista',
  },
  {
    chave: 'cidade',
    rotulo: 'Cidade / Município',
    obrigatorio: false,
    descricao: 'Nome do município',
    sinonimos: ['cidade', 'municipio', 'localidade'],
    exemplo: 'São Paulo',
  },
  {
    chave: 'uf',
    rotulo: 'UF',
    obrigatorio: false,
    descricao: 'Sigla da Unidade Federativa (SP, RJ, MG...)',
    sinonimos: ['uf', 'estado', 'sigla_estado'],
    exemplo: 'SP',
  },
  {
    chave: 'email',
    rotulo: 'E-mail',
    obrigatorio: false,
    descricao: 'E-mail de contato corporativo',
    sinonimos: ['email', 'e-mail', 'correio_eletronico', 'email_contato'],
    exemplo: 'contato@alfa.com.br',
  },
  {
    chave: 'telefone',
    rotulo: 'Telefone / WhatsApp',
    obrigatorio: false,
    descricao: 'Telefone com DDD',
    sinonimos: ['telefone', 'fone', 'celular', 'whatsapp', 'tel'],
    exemplo: '(11) 98765-4321',
  },
  {
    chave: 'socios',
    rotulo: 'Sócios / QSA',
    obrigatorio: false,
    descricao: 'Nomes dos sócios administradores ou percentuais',
    sinonimos: ['socios', 'socios_qsa', 'qsa', 'quadro_societario', 'socios_administradores'],
    exemplo: 'Carlos Silva (Adm), Mariana Souza',
  },
  {
    chave: 'honorarios_mensais',
    rotulo: 'Honorários Mensais (R$)',
    obrigatorio: false,
    descricao: 'Valor da mensalidade contábil contratada',
    sinonimos: ['honorarios_mensais', 'honorarios', 'mensalidade', 'valor_mensal', 'honorario'],
    exemplo: '1250,00',
  },
  {
    chave: 'certificado_validade',
    rotulo: 'Validade Certificado (DD/MM/AAAA)',
    obrigatorio: false,
    descricao: 'Data de expiração do certificado digital e-CNPJ A1',
    sinonimos: [
      'certificado_validade',
      'validade_certificado',
      'validade cert',
      'vencimento_certificado',
      'validade_a1',
      'vencimento_a1',
      'dt_validade_cert',
    ],
    exemplo: '30/11/2026',
  },
  {
    chave: 'certificado_emissor',
    rotulo: 'Emissor do Certificado',
    obrigatorio: false,
    descricao: 'Autoridade Certificadora (ex: Certisign, Serasa, Soluti, Valid, AC OAB)',
    sinonimos: [
      'certificado_emissor',
      'emissor_certificado',
      'autoridade_certificadora',
      'ac_emissora',
      'emissor',
      'emissor_a1',
    ],
    exemplo: 'Certisign',
  },
  {
    chave: 'certificado_serie',
    rotulo: 'Nº Série Certificado',
    obrigatorio: false,
    descricao: 'Número de série hexadecimal ou identificador do certificado',
    sinonimos: [
      'certificado_serie',
      'serie_certificado',
      'numero_serie_certificado',
      'numero_serie',
      'serial_number',
    ],
    exemplo: '7C:9B:44:A1:22:90',
  },
  {
    chave: 'observacoes',
    rotulo: 'Observações / Migração',
    obrigatorio: false,
    descricao: 'Notas do sistema de origem ou particularidades',
    sinonimos: ['observacoes', 'obs', 'notas', 'anotacoes', 'sistema_origem'],
    exemplo: 'Migrado do sistema Domínio Contábil. Fechamento dia 10.',
  },
]

export interface LinhaPreviaValidada {
  linhaNumero: number
  dados: Partial<EmpresaMigracaoLinhaItem>
  status: 'valido' | 'aviso' | 'erro'
  erros: string[]
  avisos: string[]
}

/**
 * Gera conteúdo CSV modelo oficial para download
 */
export function gerarCsvModelo(): string {
  const headers = COLUNAS_SUPORTADAS.map((c) => c.rotulo).join(';')
  const linhaExemplo1 = [
    'Alfa Soluções e Tecnologia Ltda',
    'Alfa Tech',
    '33.456.789/0001-12',
    'Simples Nacional',
    'ME',
    '15/04/2021',
    '6201-5/01 - Desenvolvimento de programas',
    '206-2 - Sociedade Empresária Limitada',
    '123.456.789.001',
    '987654-1',
    '01310-100',
    'Avenida Paulista',
    '1578',
    'Conjunto 14B',
    'Bela Vista',
    'São Paulo',
    'SP',
    'contato@alfatech.com.br',
    '(11) 98765-4321',
    'Carlos Henrique Silva (60%), Juliana Costa (40%)',
    '1450,00',
    '15/12/2026',
    'Certisign AC',
    '4B:71:09:A3:88:F2',
    'Migrado de software contábil anterior. DAS unificado.',
  ].join(';')

  const linhaExemplo2 = [
    'Beta Logística e Transportes Eireli',
    'Beta Express',
    '11.222.333/0001-81',
    'Lucro Presumido',
    'EPP',
    '02/08/2018',
    '4930-2/02 - Transporte rodoviário de carga',
    '230-5 - Empresa Individual de Resp. Ltda',
    '987.654.321.002',
    '345123-8',
    '04571-010',
    'Rua Funchal',
    '418',
    '3º Andar',
    'Vila Olímpia',
    'São Paulo',
    'SP',
    'financeiro@betalog.com.br',
    '(11) 97654-3210',
    'Roberto Almeida (100%)',
    '2200,00',
    '20/08/2026',
    'Serasa Experian',
    '9C:12:88:B4:71:E5',
    'Emissão de CTe e apuração de ICMS/PIS/COFINS.',
  ].join(';')

  // UTF-8 BOM para garantir correta abertura no Microsoft Excel em pt-BR
  return `\uFEFF${headers}\r\n${linhaExemplo1}\r\n${linhaExemplo2}\r\n`
}

/**
 * Faz parse de texto CSV ou TSV com suporte a aspas duplas e delimitadores comuns (; , \t)
 */
export function parseCsvText(rawText: string): { cabecalhos: string[]; linhas: string[][] } {
  // Remove UTF-8 BOM se presente
  const text = rawText.charCodeAt(0) === 0xfeff ? rawText.slice(1) : rawText

  const lineBreaksRegex = /\r\n|\n|\r/
  const rawLines = text.split(lineBreaksRegex).filter((l) => l.trim().length > 0)

  if (rawLines.length === 0) {
    return { cabecalhos: [], linhas: [] }
  }

  // Detectar delimitador: ;, vírgula ou tab
  const firstLine = rawLines[0]
  const countSemi = (firstLine.match(/;/g) || []).length
  const countComma = (firstLine.match(/,/g) || []).length
  const countTab = (firstLine.match(/\t/g) || []).length

  let delimiter = ';'
  if (countTab > countSemi && countTab > countComma) {
    delimiter = '\t'
  } else if (countComma > countSemi) {
    delimiter = ','
  }

  // Parser robusto respeitando aspas
  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let cur = ''
    let insideQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          insideQuotes = !insideQuotes
        }
      } else if (char === delimiter && !insideQuotes) {
        result.push(cur.trim())
        cur = ''
      } else {
        cur += char
      }
    }
    result.push(cur.trim())
    return result
  }

  const cabecalhos = parseLine(rawLines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim())
  const linhas: string[][] = []

  for (let i = 1; i < rawLines.length; i++) {
    const parsed = parseLine(rawLines[i]).map((c) => c.replace(/^["']|["']$/g, '').trim())
    // Ignora linhas totalmente vazias
    if (parsed.some((c) => c.length > 0)) {
      linhas.push(parsed)
    }
  }

  return { cabecalhos, linhas }
}

/**
 * Detecta mapeamento automático entre colunas encontradas e colunas suportadas
 */
export function detectarMapeamentoAutomatico(
  cabecalhosArquivo: string[],
): Record<string, keyof EmpresaMigracaoLinhaItem | ''> {
  const map: Record<string, keyof EmpresaMigracaoLinhaItem | ''> = {}

  cabecalhosArquivo.forEach((colName) => {
    const norm = colName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .trim()

    let matchKey: keyof EmpresaMigracaoLinhaItem | '' = ''

    for (const sup of COLUNAS_SUPORTADAS) {
      const rotuloNorm = sup.rotulo
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .trim()

      if (norm === rotuloNorm || sup.sinonimos.includes(norm)) {
        matchKey = sup.chave
        break
      }

      // Casos especiais comuns
      if (norm.includes('cnpj') && sup.chave === 'cnpj') {
        matchKey = 'cnpj'
        break
      }
      if (
        (norm.includes('razao') || norm.includes('empresa') || norm === 'nome') &&
        sup.chave === 'razao_social'
      ) {
        matchKey = 'razao_social'
        break
      }
      if (norm.includes('fantasia') && sup.chave === 'nome_fantasia') {
        matchKey = 'nome_fantasia'
        break
      }
      if (norm.includes('regime') && sup.chave === 'regime_tributario') {
        matchKey = 'regime_tributario'
        break
      }
      if (norm.includes('porte') && sup.chave === 'porte') {
        matchKey = 'porte'
        break
      }
      if (norm.includes('cnae') && sup.chave === 'cnae') {
        matchKey = 'cnae'
        break
      }
      if (
        norm.includes('honorari') ||
        (norm.includes('mensalid') && sup.chave === 'honorarios_mensais')
      ) {
        matchKey = 'honorarios_mensais'
        break
      }
      if (
        (norm.includes('validade') && norm.includes('cert')) ||
        norm.includes('vencimento_cert') ||
        norm.includes('validade_a1')
      ) {
        matchKey = 'certificado_validade'
        break
      }
      if (
        (norm.includes('emissor') && norm.includes('cert')) ||
        norm.includes('autoridade_cert') ||
        norm === 'emissor'
      ) {
        matchKey = 'certificado_emissor'
        break
      }
      if (
        (norm.includes('serie') && norm.includes('cert')) ||
        norm.includes('serial_number') ||
        norm === 'numero_serie'
      ) {
        matchKey = 'certificado_serie'
        break
      }
    }

    map[colName] = matchKey
  })

  return map
}

/**
 * Converte as linhas brutas com base no mapeamento e executa validação completa
 */
export function validarLinhasMigracao(
  cabecalhosArquivo: string[],
  linhasBrutas: string[][],
  mapeamento: Record<string, keyof EmpresaMigracaoLinhaItem | ''>,
): LinhaPreviaValidada[] {
  return linhasBrutas.map((linha, idx) => {
    const linhaNumero = idx + 2 // Linha 1 é o cabeçalho
    const obj: Partial<EmpresaMigracaoLinhaItem> = {}

    cabecalhosArquivo.forEach((colName, colIdx) => {
      const targetKey = mapeamento[colName]
      if (targetKey && linha[colIdx] !== undefined) {
        const val = linha[colIdx].trim()
        ;(obj as Record<string, unknown>)[targetKey] = val
      }
    })

    const erros: string[] = []
    const avisos: string[] = []

    // 1. Validação de Razão Social
    if (!obj.razao_social || obj.razao_social.trim().length === 0) {
      erros.push('Razão Social obrigatória não preenchida.')
    }

    // 2. Validação de CNPJ
    if (!obj.cnpj || obj.cnpj.trim().length === 0) {
      erros.push('CNPJ obrigatório não preenchido.')
    } else {
      const cleanCnpj = obj.cnpj.replace(/\D/g, '')
      if (cleanCnpj.length !== 14) {
        erros.push(`CNPJ incompleto (${cleanCnpj.length} dígitos em vez de 14).`)
      } else if (!isValidCnpj(cleanCnpj)) {
        erros.push('CNPJ inválido (dígitos verificadores incorretos).')
      }
    }

    // 3. Validação de CEP
    if (obj.cep) {
      const cleanCep = obj.cep.replace(/\D/g, '')
      if (cleanCep.length !== 8) {
        avisos.push(`CEP com formato incomum (${cleanCep.length} dígitos).`)
      }
    }

    // 4. Validação de E-mail
    if (obj.email) {
      const emailTrim = obj.email.trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
        avisos.push('Formato de e-mail pode ser inválido.')
      }
    }

    // 5. Validação de Data de Abertura
    if (obj.data_abertura) {
      const dt = obj.data_abertura.trim()
      const isBrDate = /^\d{2}\/\d{2}\/\d{4}$/.test(dt)
      const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(dt)
      if (!isBrDate && !isIsoDate) {
        avisos.push('Data de abertura em formato não reconhecido (use DD/MM/AAAA).')
      }
    }

    // 6. Validação de Certificado Digital (se fornecido na planilha)
    if (obj.certificado_validade) {
      const v = obj.certificado_validade.trim()
      const isBrDate = /^\d{2}\/\d{2}\/\d{4}$/.test(v)
      const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(v)
      if (!isBrDate && !isIsoDate) {
        avisos.push('Validade do certificado em formato não reconhecido (use DD/MM/AAAA).')
      }
    }

    let status: 'valido' | 'aviso' | 'erro' = 'valido'
    if (erros.length > 0) {
      status = 'erro'
    } else if (avisos.length > 0) {
      status = 'aviso'
    }

    return {
      linhaNumero,
      dados: obj,
      status,
      erros,
      avisos,
    }
  })
}

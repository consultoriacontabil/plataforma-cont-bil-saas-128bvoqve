import { maskCnpj, maskCep, maskPhone, isValidCnpj } from '@/lib/formatters'
import type { Empresa, EmpresaRegime, EmpresaPorte } from '@/types'

export interface DadosConsultaPublicaCnpj {
  sucesso: true
  fonte: string
  dataConsulta: string
  dados: {
    razao_social: string
    nome_fantasia: string
    cnpj: string
    inscricao_estadual?: string
    cnae_principal_codigo?: string
    cnae_principal_descricao?: string
    cnaes_secundarios?: Array<{ codigo: string; descricao: string }>
    natureza_juridica?: string
    regime_tributario_sugerido?: EmpresaRegime
    porte_sugerido?: EmpresaPorte
    data_abertura?: string
    situacao_cadastral?: string
    motivo_situacao_cadastral?: string
    cep?: string
    logradouro?: string
    numero?: string
    complemento?: string
    bairro?: string
    cidade?: string
    uf?: string
    email?: string
    telefone?: string
    socios_qsa?: Array<{
      nome: string
      qualificacao: string
      pais_origem?: string
      nome_representante?: string
    }>
    capital_social?: number
  }
  aviso?: string
}

export interface ConsultaPublicaError {
  sucesso: false
  mensagem: string
  codigo?: 'RATE_LIMIT' | 'NOT_FOUND' | 'INVALID_CNPJ' | 'UNAVAILABLE' | 'GENERIC'
}

/**
 * Normaliza regime tributário a partir dos dados públicos
 */
function inferirRegime(
  opcaoSimples?: boolean | null,
  opcaoMei?: boolean | null,
  porte?: string,
): EmpresaRegime {
  if (opcaoMei) return 'mei'
  if (opcaoSimples) return 'simples_nacional'
  const p = (porte || '').toLowerCase()
  if (p.includes('mei')) return 'mei'
  if (p.includes('micro') || p.includes('pequeno') || p === 'me' || p === 'epp') {
    return 'simples_nacional'
  }
  return 'lucro_presumido'
}

/**
 * Normaliza porte a partir das respostas públicas
 */
function inferirPorte(porteStr?: string): EmpresaPorte {
  if (!porteStr) return 'me'
  const p = porteStr.toLowerCase().trim()
  if (p.includes('mei')) return 'mei'
  if (p.includes('micro') || p === 'me') return 'me'
  if (p.includes('pequeno') || p === 'epp') return 'epp'
  return 'demais'
}

/**
 * Formata data no formato YYYY-MM-DD
 */
function normalizarDataAbertura(dataRaw?: string): string {
  if (!dataRaw) return ''
  const clean = dataRaw.trim()
  // Se for DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('/')
    return `${y}-${m}-${d}`
  }
  // Se já for YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    return clean.slice(0, 10)
  }
  return ''
}

/**
 * Consulta CEP no ViaCEP para complementar ou validar endereço
 */
export async function consultarViaCep(cep: string): Promise<{
  logradouro?: string
  bairro?: string
  cidade?: string
  uf?: string
  complemento?: string
} | null> {
  const clean = cep.replace(/\D/g, '')
  if (clean.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`, {
      method: 'GET',
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.erro) return null
    return {
      logradouro: data.logradouro || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      uf: data.uf || '',
      complemento: data.complemento || '',
    }
  } catch (err) {
    console.warn('Falha na consulta ao ViaCEP:', err)
    return null
  }
}

/**
 * Consulta dados completos de pessoa jurídica por CNPJ em fontes públicas oficiais (BrasilAPI com fallback para ReceitaWS)
 */
export async function consultarCnpjPublico(
  cnpj: string,
): Promise<DadosConsultaPublicaCnpj | ConsultaPublicaError> {
  const cleanCnpj = cnpj.replace(/\D/g, '')

  if (cleanCnpj.length !== 14 || !isValidCnpj(cleanCnpj)) {
    return {
      sucesso: false,
      codigo: 'INVALID_CNPJ',
      mensagem: 'CNPJ inválido ou incompleto. Verifique os 14 dígitos.',
    }
  }

  const dataAtual = new Date().toLocaleDateString('pt-BR')

  // Tentativa 1: BrasilAPI (v2)
  try {
    const resBrasil = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    if (resBrasil.ok) {
      const bData = await resBrasil.json()

      // Enriquecimento opcional com ViaCEP se vier CEP
      let enderecoComplementar: {
        logradouro?: string
        bairro?: string
        cidade?: string
        uf?: string
      } | null = null
      if (bData.cep) {
        enderecoComplementar = await consultarViaCep(bData.cep)
      }

      const socios = Array.isArray(bData.qsa)
        ? bData.qsa.map(
            (s: {
              nome_socio?: string
              qualifica_socio?: string
              faixa_etaria?: string
              nome_representante_legal?: string
            }) => ({
              nome: s.nome_socio || '',
              qualificacao: s.qualifica_socio || 'Sócio',
              nome_representante: s.nome_representante_legal || undefined,
            }),
          )
        : []

      const cnaesSecundarios = Array.isArray(bData.cnaes_secundarios)
        ? bData.cnaes_secundarios.map((c: { codigo?: number | string; descricao?: string }) => ({
            codigo: String(c.codigo || ''),
            descricao: c.descricao || '',
          }))
        : []

      return {
        sucesso: true,
        fonte: 'BrasilAPI (Receita Federal / QSA)',
        dataConsulta: dataAtual,
        dados: {
          razao_social: bData.razao_social || '',
          nome_fantasia: bData.nome_fantasia || bData.razao_social || '',
          cnpj: maskCnpj(cleanCnpj),
          cnae_principal_codigo: bData.cnae_fiscal ? String(bData.cnae_fiscal) : undefined,
          cnae_principal_descricao: bData.cnae_fiscal_descricao || undefined,
          cnaes_secundarios: cnaesSecundarios,
          natureza_juridica: bData.natureza_juridica || undefined,
          regime_tributario_sugerido: inferirRegime(
            bData.opcao_pelo_simples,
            bData.opcao_pelo_mei,
            bData.porte,
          ),
          porte_sugerido: inferirPorte(bData.porte),
          data_abertura: normalizarDataAbertura(bData.data_inicio_atividade),
          situacao_cadastral: bData.descricao_situacao_cadastral || undefined,
          motivo_situacao_cadastral: bData.descricao_motivo_situacao_cadastral || undefined,
          cep: maskCep(bData.cep || ''),
          logradouro: enderecoComplementar?.logradouro || bData.logradouro || '',
          numero: bData.numero || '',
          complemento: bData.complemento || '',
          bairro: enderecoComplementar?.bairro || bData.bairro || '',
          cidade: enderecoComplementar?.cidade || bData.municipio || '',
          uf: (enderecoComplementar?.uf || bData.uf || 'SP').toUpperCase(),
          email: bData.email || '',
          telefone: bData.ddd_telefone_1 ? maskPhone(bData.ddd_telefone_1) : '',
          socios_qsa: socios,
          capital_social:
            typeof bData.capital_social === 'number' ? bData.capital_social : undefined,
        },
      }
    } else if (resBrasil.status === 404) {
      return {
        sucesso: false,
        codigo: 'NOT_FOUND',
        mensagem: 'CNPJ não encontrado na base oficial de dados da Receita Federal.',
      }
    } else if (resBrasil.status === 429) {
      // Tenta fallback ReceitaWS
      console.warn('BrasilAPI rate limited, tentando ReceitaWS...')
    }
  } catch (err) {
    console.warn('Falha na requisição BrasilAPI, tentando fallback:', err)
  }

  // Tentativa 2: Fallback ReceitaWS público
  try {
    const resReceita = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cleanCnpj}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    if (resReceita.ok) {
      const rData = await resReceita.json()

      if (rData.status === 'ERROR') {
        return {
          sucesso: false,
          codigo: 'NOT_FOUND',
          mensagem: rData.message || 'CNPJ não localizado na Receita Federal.',
        }
      }

      const socios = Array.isArray(rData.qsa)
        ? rData.qsa.map((s: { nome?: string; qual?: string }) => ({
            nome: s.nome || '',
            qualificacao: s.qual || 'Sócio',
          }))
        : []

      const cnaePrincipal =
        Array.isArray(rData.atividade_principal) && rData.atividade_principal[0]
          ? {
              codigo: rData.atividade_principal[0].code || '',
              descricao: rData.atividade_principal[0].text || '',
            }
          : undefined

      const cnaesSecundarios = Array.isArray(rData.atividades_secundarias)
        ? rData.atividades_secundarias.map((c: { code?: string; text?: string }) => ({
            codigo: c.code || '',
            descricao: c.text || '',
          }))
        : []

      return {
        sucesso: true,
        fonte: 'ReceitaWS (Receita Federal Pública)',
        dataConsulta: dataAtual,
        dados: {
          razao_social: rData.nome || '',
          nome_fantasia: rData.fantasia || rData.nome || '',
          cnpj: maskCnpj(cleanCnpj),
          cnae_principal_codigo: cnaePrincipal?.codigo,
          cnae_principal_descricao: cnaePrincipal?.descricao,
          cnaes_secundarios: cnaesSecundarios,
          natureza_juridica: rData.natureza_juridica || undefined,
          regime_tributario_sugerido: inferirRegime(
            rData.simples?.optante,
            rData.simei?.optante,
            rData.porte,
          ),
          porte_sugerido: inferirPorte(rData.porte),
          data_abertura: normalizarDataAbertura(rData.abertura),
          situacao_cadastral: rData.situacao || undefined,
          motivo_situacao_cadastral: rData.motivo_situacao || undefined,
          cep: maskCep(rData.cep || ''),
          logradouro: rData.logradouro || '',
          numero: rData.numero || '',
          complemento: rData.complemento || '',
          bairro: rData.bairro || '',
          cidade: rData.municipio || '',
          uf: (rData.uf || 'SP').toUpperCase(),
          email: rData.email || '',
          telefone: rData.telefone ? maskPhone(rData.telefone) : '',
          socios_qsa: socios,
          capital_social: rData.capital_social ? parseFloat(rData.capital_social) : undefined,
        },
      }
    } else if (resReceita.status === 429) {
      return {
        sucesso: false,
        codigo: 'RATE_LIMIT',
        mensagem:
          'Limite de requisições excedido nas fontes públicas (BrasilAPI/ReceitaWS). Aguarde 1 minuto e tente novamente, ou utilize o preenchimento por upload de Cartão CNPJ.',
      }
    }
  } catch (rErr) {
    console.error('Falha ao consultar ReceitaWS:', rErr)
  }

  return {
    sucesso: false,
    codigo: 'UNAVAILABLE',
    mensagem:
      'As APIs públicas de consulta de CNPJ (BrasilAPI/ReceitaWS) estão temporariamente indisponíveis ou instáveis. Você pode preencher manualmente ou usar a opção "Preenchimento com Documentos (Cartão CNPJ)".',
  }
}

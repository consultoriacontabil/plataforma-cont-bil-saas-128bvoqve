/**
 * Núcleo do módulo Fiscal (Fatia 2 Makro).
 *
 * - parseXmlNfe / parseXmlNfse: extração de emitente, destinatário, itens
 *   (CFOP/NCM/valores/ICMS) e totais de um XML de NF-e ou NFS-e.
 * - importarLoteXml: importa XMLs (upload manual ou lidos do GED da ELLIZA)
 *   criando movimentos + itens e preenchendo produtos/fornecedores.
 * - apurarCompetencia: cálculo de tributos conforme o regime da empresa
 *   (Simples Nacional via RBT12/faixas; Presumido e Real básico), gerando
 *   guias como lançamentos na collection fiscal_apuracoes.detalhes/guias.
 * - relatorios: resumo por Estado/CFOP e listagem de serviços municipais.
 */

import pb from '@/lib/pocketbase/client'
import type { EmpresaRegime } from '@/types'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type TipoMovimento = 'entrada' | 'saida' | 'servico_prestado' | 'servico_tomado'
export type ModeloDocumento = 'nfe' | 'nfce' | 'cte' | 'nfse'

export interface MovimentoFiscal {
  id: string
  tenant_id: string
  empresa_id: string
  tipo_movimento: TipoMovimento
  modelo_documento: ModeloDocumento
  numero_nota?: string
  serie?: string
  chave_acesso?: string
  data_emissao?: string
  competencia: string
  emitente_cnpj_cpf?: string
  emitente_nome?: string
  destinatario_cnpj_cpf?: string
  destinatario_nome?: string
  uf_emitente?: string
  municipio_emitente?: string
  valor_produtos?: number
  valor_servicos?: number
  valor_total?: number
  valor_icms?: number
  valor_icms_st?: number
  valor_fcp_st?: number
  valor_isentas?: number
  valor_pis?: number
  valor_cofins?: number
  valor_iss?: number
  natureza_operacao?: string
  origem: 'xml_upload' | 'xml_ged' | 'manual'
  arquivo_nome?: string
  documento_ged_id?: string
  created: string
  expand?: Record<string, any>
}

export interface ItemFiscal {
  id: string
  movimento_id: string
  numero_item?: number
  codigo_produto?: string
  descricao?: string
  ncm?: string
  cfop?: string
  unidade?: string
  quantidade?: number
  valor_unitario?: number
  valor_total?: number
  valor_bc_icms?: number
  aliquota_icms?: number
  valor_icms?: number
  valor_icms_st?: number
  valor_isentas?: number
}

export interface ItemXml {
  numero_item?: number
  codigo_produto?: string
  descricao?: string
  ncm?: string
  cfop?: string
  unidade?: string
  quantidade?: number
  valor_unitario?: number
  valor_total?: number
  valor_bc_icms?: number
  aliquota_icms?: number
  valor_icms?: number
  valor_icms_st?: number
  valor_fcp_st?: number
  valor_isentas?: number
}

export interface MovimentoXml {
  tipo_movimento: TipoMovimento
  modelo_documento: ModeloDocumento
  numero_nota?: string
  serie?: string
  chave_acesso?: string
  data_emissao?: string
  competencia: string
  emitente_cnpj_cpf?: string
  emitente_nome?: string
  emitente_ie?: string
  emitente_uf?: string
  emitente_municipio?: string
  destinatario_cnpj_cpf?: string
  destinatario_nome?: string
  natureza_operacao?: string
  valor_produtos?: number
  valor_servicos?: number
  valor_total?: number
  valor_icms?: number
  valor_icms_st?: number
  valor_fcp_st?: number
  valor_isentas?: number
  valor_pis?: number
  valor_cofins?: number
  valor_iss?: number
  itens: ItemXml[]
  // Fornecedor derivado (quem NÃO é a empresa): emitente na saída, destinatário na entrada
  fornecedor_cnpj_cpf?: string
  fornecedor_nome?: string
  fornecedor_ie?: string
  fornecedor_uf?: string
  fornecedor_municipio?: string
}

export interface ResultadoImportacaoXml {
  arquivo: string
  status: 'importado' | 'duplicado' | 'erro'
  movimento_id?: string
  mensagem?: string
}

// ---------------------------------------------------------------------------
// Utilidades XML / formatação
// ---------------------------------------------------------------------------

const toNum = (v: string | undefined | null): number => {
  if (!v) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const texto = (doc: Document, tag: string): string | undefined => {
  const el = doc.getElementsByTagName(tag)[0]
  if (!el || !el.textContent) return undefined
  const t = el.textContent.trim()
  return t === '' ? undefined : t
}

export const competenciaDeData = (dataIso?: string): string => {
  if (!dataIso) return new Date().toISOString().slice(0, 7)
  return dataIso.slice(0, 7)
}

export const competenciaAtual = (): string => new Date().toISOString().slice(0, 7)

const validarCnpj = (cnpj: string): boolean => {
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false
  const calc = (base: string) => {
    let peso = base.length - 7
    let soma = 0
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * peso--
      if (peso < 2) peso = 9
    }
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  const d1 = calc(c.slice(0, 12))
  const d2 = calc(c.slice(0, 12) + d1)
  return c === c.slice(0, 12) + d1 + d2
}

// ---------------------------------------------------------------------------
// Parsing NF-e (procNFe / nfe) e NFS-e
// ---------------------------------------------------------------------------

export function parseXmlNfe(xml: string): MovimentoXml | null {
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    if (doc.getElementsByTagName('parsererror').length > 0) return null
    const infNFe = doc.getElementsByTagName('infNFe')[0]
    if (!infNFe) return null

    const emit = infNFe.getElementsByTagName('emit')[0]
    const dest = infNFe.getElementsByTagName('dest')[0]
    const ide = infNFe.getElementsByTagName('ide')[0]
    const total = infNFe.getElementsByTagName('ICMSTot')[0]

    const get = (pai: Element | undefined, tag: string) =>
      pai ? pai.getElementsByTagName(tag)[0]?.textContent?.trim() || undefined : undefined

    const cnpjEmit = (get(emit, 'CNPJ') || get(emit, 'CPF') || '') as string
    const cnpjDest = (get(dest, 'CNPJ') || get(dest, 'CPF') || '') as string

    // Sentido: se o emitente é a própria empresa (cnpj da pasta/empresa), é saída;
    // a decisão final é do chamador, mas aqui assumimos saída quando há dest != emit.
    const dhEmi = get(ide, 'dhEmi') || get(ide, 'dEmi')
    const emitUf = get(emit, 'UF') || get(infNFe.getElementsByTagName('enderEmit')[0], 'UF')

    const itens: ItemXml[] = []
    const dets = infNFe.getElementsByTagName('det')
    for (let i = 0; i < dets.length; i++) {
      const det = dets[i]
      const prod = det.getElementsByTagName('prod')[0]
      const icms = det.getElementsByTagName('ICMS')[0]
      const qualquerIcms = icms?.getElementsByTagName('*')
      let bc = 0
      let aliq = 0
      let vicms = 0
      let vst = 0
      let vfcp = 0
      if (qualquerIcms) {
        for (let j = 0; j < qualquerIcms.length; j++) {
          const nome = qualquerIcms[j].tagName
          if (nome === 'vBC') bc = toNum(qualquerIcms[j].textContent)
          if (nome === 'pICMS') aliq = toNum(qualquerIcms[j].textContent)
          if (nome === 'vICMS') vicms = toNum(qualquerIcms[j].textContent)
          if (nome === 'vICMSST') vst = toNum(qualquerIcms[j].textContent)
          if (nome === 'vFCPST') vfcp = toNum(qualquerIcms[j].textContent)
        }
      }
      const cstCsosn =
        icms?.getElementsByTagName('CSOSN')[0]?.textContent?.trim() ||
        icms?.getElementsByTagName('CST')[0]?.textContent?.trim()
      const isenta =
        !vicms &&
        (cstCsosn === '102' ||
          cstCsosn === '103' ||
          cstCsosn === '300' ||
          cstCsosn === '400' ||
          cstCsosn?.startsWith('40'))
      itens.push({
        numero_item: Number(det.getAttribute('nItem') || i + 1),
        codigo_produto: get(prod, 'cProd'),
        descricao: get(prod, 'xProd'),
        ncm: get(prod, 'NCM'),
        cfop: get(prod, 'CFOP'),
        unidade: get(prod, 'uCom'),
        quantidade: toNum(get(prod, 'qCom')),
        valor_unitario: toNum(get(prod, 'vUnCom')),
        valor_total: toNum(get(prod, 'vProd')),
        valor_bc_icms: bc,
        aliquota_icms: aliq,
        valor_icms: vicms,
        valor_icms_st: vst,
        valor_fcp_st: vfcp,
        valor_isentas: isenta ? toNum(get(prod, 'vProd')) : 0,
      })
    }

    // Deteção de sentido: NF-e de saída da empresa tem natureza terminando em
    // "venda"/"remessa" e CFOPs 5xxx/6xxx de saída; de entrada tem CFOP 1xxx/2xxx.
    const cfops = itens.map((i) => i.cfop || '').filter(Boolean)
    const primeiraVenda = cfops.length
      ? cfops[0].startsWith('5') || cfops[0].startsWith('6')
      : false
    const primeiraEntrada = cfops.length
      ? cfops[0].startsWith('1') || cfops[0].startsWith('2')
      : false
    const tipo: TipoMovimento = primeiraVenda ? 'saida' : primeiraEntrada ? 'entrada' : 'saida'

    // fornecedor = o lado que não é a empresa: emitente quando é entrada, destinatário quando é saída
    const fornecedorEhEmitente = tipo === 'entrada'

    return {
      tipo_movimento: tipo,
      modelo_documento: 'nfe',
      numero_nota: get(ide, 'nNF'),
      serie: get(ide, 'serie'),
      chave_acesso: (infNFe.getAttribute('Id') || '').replace(/^NFe/i, '') || undefined,
      data_emissao: dhEmi,
      competencia: competenciaDeData(dhEmi),
      emitente_cnpj_cpf: cnpjEmit,
      emitente_nome: get(emit, 'xNome'),
      emitente_ie: get(emit, 'IE'),
      emitente_uf: emitUf,
      emitente_municipio: get(infNFe.getElementsByTagName('enderEmit')[0], 'xMun'),
      destinatario_cnpj_cpf: cnpjDest,
      destinatario_nome: get(dest, 'xNome'),
      natureza_operacao: get(ide, 'natOp'),
      valor_produtos: toNum(total ? get(total, 'vProd') : undefined),
      valor_servicos: 0,
      valor_total: toNum(total ? get(total, 'vNF') : undefined),
      valor_icms: toNum(total ? get(total, 'vICMS') : undefined),
      valor_icms_st: toNum(total ? get(total, 'vST') : undefined),
      valor_fcp_st: toNum(total ? get(total, 'vFCPST') : undefined),
      valor_isentas: itens.reduce((s, i) => s + (i.valor_isentas || 0), 0),
      valor_pis: toNum(total ? get(total, 'vPIS') : undefined),
      valor_cofins: toNum(total ? get(total, 'vCOFINS') : undefined),
      valor_iss: 0,
      itens,
      fornecedor_cnpj_cpf: fornecedorEhEmitente ? cnpjEmit : cnpjDest,
      fornecedor_nome: fornecedorEhEmitente ? get(emit, 'xNome') : get(dest, 'xNome'),
      fornecedor_ie: fornecedorEhEmitente ? get(emit, 'IE') : get(dest, 'IE'),
      fornecedor_uf: fornecedorEhEmitente ? emitUf : get(dest, 'UF'),
      fornecedor_municipio: fornecedorEhEmitente
        ? get(infNFe.getElementsByTagName('enderEmit')[0], 'xMun')
        : get(infNFe.getElementsByTagName('enderDest')[0], 'xMun'),
    }
  } catch {
    return null
  }
}

export function parseXmlNfse(xml: string): MovimentoXml | null {
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    if (doc.getElementsByTagName('parsererror').length > 0) return null

    // Layout ABRASF: CompNfse > Nfse > InfNfse; também aceita InfDeclaracaoPrestacaoServico
    const infNfse =
      doc.getElementsByTagName('InfNfse')[0] ||
      doc.getElementsByTagName('InfDeclaracaoPrestacaoServico')[0]
    if (!infNfse) return null

    const get = (pai: Element | undefined, tag: string) =>
      pai ? pai.getElementsByTagName(tag)[0]?.textContent?.trim() || undefined : undefined

    const prestador =
      infNfse.getElementsByTagName('PrestadorServico')[0] ||
      infNfse.getElementsByTagName('Prestador')[0]
    const tomador =
      infNfse.getElementsByTagName('TomadorServico')[0] ||
      infNfse.getElementsByTagName('Tomador')[0]
    const servico =
      infNfse.getElementsByTagName('Servico')[0] || infNfse.getElementsByTagName('DadosServico')[0]
    const valores = servico?.getElementsByTagName('Valores')[0]

    const cnpjPrest = get(prestador, 'Cnpj') || get(prestador, 'CNPJ') || get(prestador, 'Cpf')
    const cnpjTom = get(tomador, 'Cnpj') || get(tomador, 'CNPJ') || get(tomador, 'Cpf')
    const dataEmissao =
      get(infNfse, 'DataEmissao') ||
      get(infNfse, 'Competencia') ||
      new Date().toISOString().slice(0, 10)

    const valorServicos = toNum(get(valores, 'ValorServicos'))
    const valorIss = toNum(get(valores, 'ValorIss'))
    const baseCalculo = toNum(get(valores, 'BaseCalculo'))
    const aliquota = toNum(get(valores, 'Aliquota'))
    const isentas = toNum(get(valores, 'ValorIssqnIsento') || get(valores, 'ValorIss')) // heurística

    const prestNome = get(prestador, 'RazaoSocial') || get(prestador, 'xNome')
    const tomNome = get(tomador, 'RazaoSocial') || get(tomador, 'xNome')

    // NFS-e importada: se o prestador é a empresa → serviço prestado; senão tomado.
    // A decisão final é do chamador; aqui assumimos prestado.
    return {
      tipo_movimento: 'servico_prestado',
      modelo_documento: 'nfse',
      numero_nota: get(infNfse, 'Numero'),
      chave_acesso: get(infNfse, 'CodigoVerificacao'),
      data_emissao: dataEmissao,
      competencia: competenciaDeData(dataEmissao),
      emitente_cnpj_cpf: cnpjPrest,
      emitente_nome: prestNome,
      emitente_uf: get(prestador, 'Uf') || get(prestador, 'UfPrestador'),
      emitente_municipio: get(prestador, 'Municipio') || get(prestador, 'xMunicipio'),
      destinatario_cnpj_cpf: cnpjTom,
      destinatario_nome: tomNome,
      natureza_operacao: get(servico, 'Discriminacao')?.slice(0, 120),
      valor_produtos: 0,
      valor_servicos: valorServicos || baseCalculo,
      valor_total: valorServicos || baseCalculo,
      valor_iss: valorIss || baseCalculo * (aliquota / 100),
      valor_icms: 0,
      valor_icms_st: 0,
      valor_fcp_st: 0,
      valor_isentas: 0,
      valor_pis: 0,
      valor_cofins: 0,
      itens: [
        {
          numero_item: 1,
          descricao: get(servico, 'Discriminacao')?.slice(0, 200) || 'Serviço',
          codigo_produto: get(servico, 'ItemListaServico'),
          cfop: undefined,
          ncm: undefined,
          unidade: 'UN',
          quantidade: 1,
          valor_unitario: valorServicos || baseCalculo,
          valor_total: valorServicos || baseCalculo,
          valor_bc_icms: 0,
          valor_icms: 0,
          valor_isentas: 0,
        },
        ...[],
      ],
      fornecedor_cnpj_cpf: cnpjPrest,
      fornecedor_nome: prestNome,
      fornecedor_uf: get(prestador, 'Uf'),
      fornecedor_municipio: get(prestador, 'Municipio'),
    }
  } catch {
    return null
  }
}

/** Detecta o tipo de XML e devolve o movimento parseado (ou null). */
export function parseXmlFiscal(xml: string): MovimentoXml | null {
  const nfse = parseXmlNfse(xml)
  if (nfse) return nfse
  return parseXmlNfe(xml)
}

// ---------------------------------------------------------------------------
// Cadastro automático de produtos/fornecedores
// ---------------------------------------------------------------------------

async function garantirFornecedor(
  tenantId: string,
  empresaId: string,
  mov: MovimentoXml,
): Promise<void> {
  if (!mov.fornecedor_cnpj_cpf || !mov.fornecedor_nome) return
  const doc = mov.fornecedor_cnpj_cpf.replace(/\D/g, '')
  if (!doc) return
  try {
    await pb
      .collection('fiscais_fornecedores')
      .getFirstListItem(`tenant_id="${tenantId}" && empresa_id="${empresaId}" && cnpj_cpf="${doc}"`)
    return // já existe
  } catch {
    /* não existe — criar */
  }
  try {
    await pb.collection('fiscais_fornecedores').create({
      tenant_id: tenantId,
      empresa_id: empresaId,
      cnpj_cpf: doc,
      nome_razao_social: mov.fornecedor_nome,
      inscricao_estadual: mov.fornecedor_ie,
      uf: mov.fornecedor_uf,
      municipio: mov.fornecedor_municipio,
      origem: 'xml',
    })
  } catch {
    /* corrida com outro import — ignora */
  }
}

async function garantirProdutos(
  tenantId: string,
  empresaId: string,
  itens: ItemXml[],
): Promise<void> {
  const vistos = new Set<string>()
  for (const item of itens) {
    const codigo = (item.codigo_produto || '').trim()
    if (!codigo || vistos.has(codigo)) continue
    vistos.add(codigo)
    try {
      await pb
        .collection('fiscais_produtos')
        .getFirstListItem(
          `tenant_id="${tenantId}" && empresa_id="${empresaId}" && codigo="${codigo}"`,
        )
      continue
    } catch {
      /* não existe — criar */
    }
    try {
      await pb.collection('fiscais_produtos').create({
        tenant_id: tenantId,
        empresa_id: empresaId,
        codigo,
        descricao: item.descricao || `Produto ${codigo}`,
        ncm: item.ncm,
        cfop_padrao: item.cfop,
        unidade: item.unidade,
        valor_unitario: item.valor_unitario,
        origem: 'xml',
      })
    } catch {
      /* corrida — ignora */
    }
  }
}

// ---------------------------------------------------------------------------
// Importação em lote
// ---------------------------------------------------------------------------

export interface EntradaLote {
  nome: string
  conteudo: string
  /** id do documento no GED (quando o XML veio da ELLIZA via /ged) */
  documentoGedId?: string
  origem: 'xml_upload' | 'xml_ged'
}

/**
 * Importa um lote de XMLs para a empresa/competência.
 * Cada XML válido vira 1 movimento + N itens, com produtos/fornecedores
 * preenchidos automaticamente. Chave de acesso duplicada = 'duplicado'.
 */
export async function importarLoteXml(params: {
  tenantId: string
  empresaId: string
  usuarioId?: string
  /** Força o sentido quando conhecido (ex.: pasta de entrada do GED) */
  forcarTipo?: TipoMovimento
  entradas: EntradaLote[]
}): Promise<ResultadoImportacaoXml[]> {
  const { tenantId, empresaId, usuarioId, entradas } = params
  const resultados: ResultadoImportacaoXml[] = []

  for (const entrada of entradas) {
    try {
      const mov = parseXmlFiscal(entrada.conteudo)
      if (!mov) {
        resultados.push({
          arquivo: entrada.nome,
          status: 'erro',
          mensagem: 'XML não reconhecido como NF-e/NFS-e',
        })
        continue
      }

      if (params.forcarTipo) mov.tipo_movimento = params.forcarTipo

      // dedupe por chave
      if (mov.chave_acesso) {
        try {
          await pb
            .collection('fiscais_movimentos')
            .getFirstListItem(`tenant_id="${tenantId}" && chave_acesso="${mov.chave_acesso}"`)
          resultados.push({
            arquivo: entrada.nome,
            status: 'duplicado',
            mensagem: 'Chave de acesso já importada',
          })
          continue
        } catch {
          /* segue */
        }
      }

      await garantirFornecedor(tenantId, empresaId, mov)
      await garantirProdutos(tenantId, empresaId, mov.itens)

      const criado = await pb.collection('fiscais_movimentos').create({
        tenant_id: tenantId,
        empresa_id: empresaId,
        tipo_movimento: mov.tipo_movimento,
        modelo_documento: mov.modelo_documento,
        numero_nota: mov.numero_nota,
        serie: mov.serie,
        chave_acesso: mov.chave_acesso,
        data_emissao: mov.data_emissao,
        competencia: mov.competencia,
        emitente_cnpj_cpf: mov.emitente_cnpj_cpf,
        emitente_nome: mov.emitente_nome,
        destinatario_cnpj_cpf: mov.destinatario_cnpj_cpf,
        destinatario_nome: mov.destinatario_nome,
        uf_emitente: mov.emitente_uf,
        municipio_emitente: mov.emitente_municipio,
        valor_produtos: mov.valor_produtos,
        valor_servicos: mov.valor_servicos,
        valor_total: mov.valor_total,
        valor_icms: mov.valor_icms,
        valor_icms_st: mov.valor_icms_st,
        valor_fcp_st: mov.valor_fcp_st,
        valor_isentas: mov.valor_isentas,
        valor_pis: mov.valor_pis,
        valor_cofins: mov.valor_cofins,
        valor_iss: mov.valor_iss,
        natureza_operacao: mov.natureza_operacao,
        origem: entrada.origem,
        arquivo_nome: entrada.nome,
        documento_ged_id: entrada.documentoGedId,
        importado_por: usuarioId,
      })

      if (mov.itens.length > 0) {
        await pb.collection('fiscais_itens').create(
          mov.itens.map((i) => ({
            tenant_id: tenantId,
            movimento_id: criado.id,
            numero_item: i.numero_item,
            codigo_produto: i.codigo_produto,
            descricao: i.descricao,
            ncm: i.ncm,
            cfop: i.cfop,
            unidade: i.unidade,
            quantidade: i.quantidade,
            valor_unitario: i.valor_unitario,
            valor_total: i.valor_total,
            valor_bc_icms: i.valor_bc_icms,
            aliquota_icms: i.aliquota_icms,
            valor_icms: i.valor_icms,
            valor_icms_st: i.valor_icms_st,
            valor_isentas: i.valor_isentas,
            origem_arquivo: entrada.nome,
          })),
        )
      }

      resultados.push({ arquivo: entrada.nome, status: 'importado', movimento_id: criado.id })
    } catch (e: any) {
      resultados.push({
        arquivo: entrada.nome,
        status: 'erro',
        mensagem: e?.message || 'Falha ao importar',
      })
    }
  }

  return resultados
}

/** Lista XMLs (NF-e/NFS-e) do GED da empresa, prontos para importação. */
export async function listarXmlsDoGed(params: {
  empresaId: string
  competencia?: string
}): Promise<{ id: string; nome: string; competencia?: string; arquivo: File }[]> {
  const filtros = [`empresa_id="${params.empresaId}"`]
  try {
    const docs = await pb.collection('documentos').getList(1, 200, {
      filter: filtros.join(' && '),
      sort: '-created',
    })
    return docs.items
      .filter((d: any) => /\.(xml|nfe|nfse)$/i.test(d.nome || d.arquivo || ''))
      .filter(
        (d: any) => !params.competencia || (d.competencia || '').startsWith(params.competencia),
      )
      .map((d: any) => ({
        id: d.id,
        nome: d.nome || d.arquivo || 'documento.xml',
        competencia: d.competencia,
        arquivo: d.arquivo ? pb.files.getURL(d as any, d.arquivo) : '',
      })) as any
  } catch {
    return []
  }
}

/** Busca o conteúdo dos XMLs do GED e devolve entradas prontas para importarLoteXml. */
export async function carregarXmlsDoGed(params: {
  empresaId: string
  competencia?: string
}): Promise<EntradaLote[]> {
  const docs = await listarXmlsDoGed(params)
  const entradas: EntradaLote[] = []
  for (const doc of docs) {
    if (!doc.arquivo) continue
    try {
      const resp = await fetch(doc.arquivo as unknown as string)
      const conteudo = await resp.text()
      if (conteudo.includes('<'))
        entradas.push({ nome: doc.nome, conteudo, documentoGedId: doc.id, origem: 'xml_ged' })
    } catch {
      /* ignora arquivo ilegível */
    }
  }
  return entradas
}

// ---------------------------------------------------------------------------
// Leitura de movimentos/itens
// ---------------------------------------------------------------------------

export async function listarMovimentos(params: {
  tenantId: string
  empresaId: string
  competencia?: string
  tipoMovimento?: TipoMovimento
}): Promise<MovimentoFiscal[]> {
  const filtros = [`tenant_id="${params.tenantId}"`, `empresa_id="${params.empresaId}"`]
  if (params.competencia) filtros.push(`competencia="${params.competencia}"`)
  if (params.tipoMovimento) filtros.push(`tipo_movimento="${params.tipoMovimento}"`)
  const res = await pb.collection('fiscais_movimentos').getList(1, 200, {
    filter: filtros.join(' && '),
    sort: '-data_emissao',
  })
  return res.items as unknown as MovimentoFiscal[]
}

export async function listarItensDeMovimentos(movimentoIds: string[]): Promise<ItemFiscal[]> {
  if (movimentoIds.length === 0) return []
  const filtro = movimentoIds.map((id) => `movimento_id="${id}"`).join(' || ')
  const res = await pb.collection('fiscais_itens').getList(1, 500, { filter: filtro })
  return res.items as unknown as ItemFiscal[]
}

export async function excluirMovimento(id: string): Promise<void> {
  await pb.collection('fiscais_movimentos').delete(id)
}

// ---------------------------------------------------------------------------
// Apuração automática por regime
// ---------------------------------------------------------------------------

export interface LinhaGuia {
  tributo: string
  base: number
  aliquota: number
  valor: number
  vencimento: string
}

export interface ApuracaoResultado {
  regime: EmpresaRegime
  receita_tributavel: number
  receita_isenta: number
  rbt12?: number
  anexo_simples?: string
  total_tributos: number
  guias: LinhaGuia[]
  detalhes: string
}

// Faixas dos anexos do Simples Nacional (valores vigentes, fonte: parâmetros seedados
// na collection parametros_normativos do tenant — usar quando disponível).
const ANEXOS_SIMPLES: Record<
  string,
  { teto: number; faixas: { ate: number; aliq: number; deduzir: number }[] }
> = {
  II: {
    teto: 4800000,
    faixas: [
      { ate: 180000, aliq: 7.3, deduzir: 0 },
      { ate: 360000, aliq: 9.5, deduzir: 8100 },
      { ate: 720000, aliq: 10.8, deduzir: 9720 },
      { ate: 1800000, aliq: 14.3, deduzir: 24480 },
      { ate: 3600000, aliq: 17.5, deduzir: 102840 },
      { ate: 4800000, aliq: 19, deduzir: 159180 },
    ],
  },
  III: {
    teto: 4800000,
    faixas: [
      { ate: 180000, aliq: 6, deduzir: 0 },
      { ate: 360000, aliq: 11.2, deduzir: 9360 },
      { ate: 720000, aliq: 13.5, deduzir: 17640 },
      { ate: 1800000, aliq: 16, deduzir: 35640 },
      { ate: 3600000, aliq: 21, deduzir: 125640 },
      { ate: 4800000, aliq: 33, deduzir: 648000 },
    ],
  },
  IV: {
    teto: 4800000,
    faixas: [
      { ate: 180000, aliq: 4.5, deduzir: 0 },
      { ate: 360000, aliq: 9, deduzir: 8100 },
      { aliq: 10.2, ate: 720000, deduzir: 12420 },
      { ate: 1800000, aliq: 14, deduzir: 39780 },
      { ate: 3600000, aliq: 22, deduzir: 183780 },
      { ate: 4800000, aliq: 33, deduzir: 828000 },
    ],
  },
  V: {
    teto: 4800000,
    faixas: [
      { ate: 180000, aliq: 15.5, deduzir: 0 },
      { ate: 360000, aliq: 18, deduzir: 4500 },
      { ate: 720000, aliq: 19.5, deduzir: 9900 },
      { ate: 1800000, aliq: 20.5, deduzir: 17100 },
      { ate: 3600000, aliq: 23, deduzir: 62100 },
      { ate: 4800000, aliq: 30.5, deduzir: 540000 },
    ],
  },
}

/** Parâmetros do tenant (parametros_normativos) — fallback para constantes. */
async function carregarAnexoSimples(tenantId: string, anexo: string) {
  try {
    const registro = await pb
      .collection('parametros_normativos')
      .getFirstListItem(`tenant_id="${tenantId}" && tipo="simples_nacional_anexos" && ativo=true`)
    const tabela = registro?.tabela_json?.[anexo]
    if (tabela?.faixas) return tabela
  } catch {
    /* usa constantes */
  }
  return ANEXOS_SIMPLES[anexo] || ANEXOS_SIMPLES.III
}

function calcularFaixaSimples(
  faixas: { ate: number; aliq: number; deduzir: number }[],
  rbt12: number,
): { aliqEfetiva: number; faixa: number } {
  const faixa = faixas.find((f) => rbt12 <= f.ate) || faixas[faixas.length - 1]
  const aliqEfetiva = ((rbt12 * faixa.aliq) / 100 - faixa.deduzir) / rbt12
  return { aliqEfetiva: Math.max(aliqEfetiva, 0), faixa: faixas.indexOf(faixa) + 1 }
}

const ultimoDiaMes = (competencia: string): string => {
  const [ano, mes] = competencia.split('-').map(Number)
  const d = new Date(ano, mes, 0)
  return d.toISOString().slice(0, 10)
}

const dia10 = (competencia: string): string => `${competencia}-10`
const dia20 = (competencia: string): string => `${competencia}-20`
const dia25 = (competencia: string): string => `${competencia}-25`

export async function apurarCompetencia(params: {
  tenantId: string
  empresaId: string
  competencia: string
  regime: 'simples_nacional' | 'lucro_presumido' | 'lucro_real'
  anexoSimples?: string
  /** faturamento bruto dos últimos 11 meses + competência (RBT12) — se não informado, calcula das apurações/movimentos */
  receitasUltimos12Meses?: number
  confirmar?: boolean
}): Promise<ApuracaoResultado> {
  const { tenantId, empresaId, competencia, regime } = params

  // Receita da competência a partir dos movimentos (saídas + serviços prestados)
  const movimentos = await listarMovimentos({ tenantId, empresaId, competencia })
  const receitaTributavel = movimentos
    .filter((m) => m.tipo_movimento === 'saida' || m.tipo_movimento === 'servico_prestado')
    .reduce((s, m) => s + (m.valor_total || 0), 0)
  const receitaIsenta = movimentos.reduce((s, m) => s + (m.valor_isentas || 0), 0)

  let guias: LinhaGuia[] = []
  let detalhes = ''
  let rbt12: number | undefined
  let anexoUsado: string | undefined

  if (regime === 'simples_nacional') {
    anexoUsado = params.anexoSimples || 'III'
    const rbt12Param = params.receitasUltimos12Meses
    if (rbt12Param && rbt12Param > 0) {
      rbt12 = rbt12Param
    } else {
      // RBT12 aproximado: soma das receitas do ano até a competência (saídas + serviços prestados)
      const ano = competencia.slice(0, 4)
      const movimentosAno = await pb.collection('fiscais_movimentos').getFullList({
        filter: `tenant_id="${tenantId}" && empresa_id="${empresaId}" && competencia~"${ano}"`,
      })
      rbt12 = (movimentosAno as unknown as MovimentoFiscal[])
        .filter(
          (m) =>
            m.competencia <= competencia &&
            (m.tipo_movimento === 'saida' || m.tipo_movimento === 'servico_prestado'),
        )
        .reduce((s, m) => s + (m.valor_total || 0), 0)
    }
    const tabela = await carregarAnexoSimples(tenantId, anexoUsado)
    const { aliqEfetiva, faixa } = calcularFaixaSimples(tabela.faixas, rbt12 || receitaTributavel)
    const valorSimples = receitaTributavel * aliqEfetiva
    guias = [
      {
        tributo: `DAS (${anexoUsado}, faixa ${faixa}, alíquota efetiva ${(aliqEfetiva * 100).toFixed(2)}%)`,
        base: receitaTributavel,
        aliquota: aliqEfetiva * 100,
        valor: valorSimples,
        vencimento: dia20(competencia),
      },
    ]
    detalhes = JSON.stringify({ tipo: 'simples', anexo: anexoUsado, rbt12, faixa, aliqEfetiva })
  } else if (regime === 'lucro_presumido') {
    // Presunções: comércio/indústria 8% (IRPJ/CSLL 9%), serviços 32%
    const presuncaoServicos = (params.anexoSimples || '') === 'servicos'
    const pctPresuncao = presuncaoServicos ? 32 : 8
    const baseIrpj = receitaTributavel * (pctPresuncao / 100)
    const irpj = baseIrpj * 0.15
    const baseCsll = (receitaTributavel * (presuncaoServicos ? 32 : 12)) / 100
    const csll = baseCsll * 0.09
    const pis = receitaTributavel * 0.0065
    const cofins = receitaTributavel * 0.03
    guias = [
      {
        tributo: 'IRPJ (presunção 15%)',
        base: baseIrpj,
        aliquota: 15,
        valor: irpj,
        vencimento: ultimoDiaMes(competencia),
      },
      {
        tributo: 'CSLL (presunção 9%)',
        base: baseCsll,
        aliquota: 9,
        valor: csll,
        vencimento: ultimoDiaMes(competencia),
      },
      {
        tributo: 'PIS (0,65%)',
        base: receitaTributavel,
        aliquota: 0.65,
        valor: pis,
        vencimento: dia25(competencia),
      },
      {
        tributo: 'COFINS (3%)',
        base: receitaTributavel,
        aliquota: 3,
        valor: cofins,
        vencimento: dia25(competencia),
      },
    ]
    detalhes = JSON.stringify({ tipo: 'presumido', presuncao: pctPresuncao, baseIrpj, baseCsll })
  } else {
    // Lucro Real básico: IRPJ 15% + adicional 10% sobre o que exceder R$ 20k/mês
    const base = receitaTributavel // simplificado — sem CSLL sobre lucro apurado real
    const irpj = base * 0.15
    const adicional = Math.max(0, base - 20000) * 0.1
    const csll = base * 0.09
    const pis = receitaTributavel * 0.0165
    const cofins = receitaTributavel * 0.076
    guias = [
      {
        tributo: 'IRPJ 15%',
        base,
        aliquota: 15,
        valor: irpj,
        vencimento: ultimoDiaMes(competencia),
      },
      {
        tributo: 'IRPJ adicional 10%',
        base: Math.max(0, base - 20000),
        aliquota: 10,
        valor: adicional,
        vencimento: ultimoDiaMes(competencia),
      },
      { tributo: 'CSLL 9%', base, aliquota: 9, valor: csll, vencimento: ultimoDiaMes(competencia) },
      {
        tributo: 'PIS 1,65%',
        base: receitaTributavel,
        aliquota: 1.65,
        valor: pis,
        vencimento: dia25(competencia),
      },
      {
        tributo: 'COFINS 7,6%',
        base: receitaTributavel,
        aliquota: 7.6,
        valor: cofins,
        vencimento: dia25(competencia),
      },
    ]
    detalhes = JSON.stringify({ tipo: 'real', base })
  }

  const total = guias.reduce((s, g) => s + g.valor, 0)

  // Persiste (upsert por empresa+competência+regime)
  let registro: any = null
  try {
    registro = await pb
      .collection('fiscal_apuracoes')
      .getFirstListItem(
        `tenant_id="${tenantId}" && empresa_id="${empresaId}" && competencia="${competencia}" && regime="${regime}"`,
      )
    await pb.collection('fiscal_apuracoes').update(registro.id, {
      receita_tributavel: receitaTributavel,
      receita_isenta: receitaIsenta,
      rbt12: rbt12,
      anexo_simples: anexoUsado,
      detalhes_json: detalhes,
      total_tributos: total,
      guias_geradas: guias.length,
      status: params.confirmar ? 'confirmada' : 'rascunho',
    })
  } catch {
    registro = await pb.collection('fiscal_apuracoes').create({
      tenant_id: tenantId,
      empresa_id: empresaId,
      competencia,
      regime,
      receita_tributavel: receitaTributavel,
      receita_isenta: receitaIsenta,
      rbt12: rbt12,
      anexo_simples: anexoUsado,
      detalhes_json: detalhes,
      total_tributos: total,
      guias_geradas: guias.length,
      status: params.confirmar ? 'confirmada' : 'rascunho',
    })
  }

  return {
    regime,
    receita_tributavel: receitaTributavel,
    receita_isenta: receitaIsenta,
    rbt12,
    anexo_simples: anexoUsado,
    total_tributos: total,
    guias,
    detalhes,
  }
}

/** Carrega a apuração salva da competência (se existir). */
export async function carregarApuracao(params: {
  tenantId: string
  empresaId: string
  competencia: string
}): Promise<any | null> {
  try {
    return await pb
      .collection('fiscal_apuracoes')
      .getFirstListItem(
        `tenant_id="${params.tenantId}" && empresa_id="${params.empresaId}" && competencia="${params.competencia}"`,
      )
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Relatórios
// ---------------------------------------------------------------------------

export interface ResumoEstadoCfop {
  uf: string
  cfop: string
  base_calculo: number
  valor_icms: number
  valor_icms_st: number
  valor_fcp_st: number
  valor_isentas: number
  valor_total: number
  quantidade_notas: number
}

/** Relatório fiscal por Estado (UF) e CFOP — entradas e saídas. */
export async function relatorioEstadoCfop(params: {
  tenantId: string
  empresaId: string
  competencia: string
  tipoMovimento?: TipoMovimento
}): Promise<ResumoEstadoCfop[]> {
  const movimentos = await listarMovimentos({
    tenantId: params.tenantId,
    empresaId: params.empresaId,
    competencia: params.competencia,
    tipoMovimento: params.tipoMovimento,
  })
  const itens = await listarItensDeMovimentos(movimentos.map((m) => m.id))
  const porMov = new Map(movimentos.map((m) => [m.id, m]))

  const mapa = new Map<string, ResumoEstadoCfop>()
  for (const item of itens) {
    const mov = porMov.get(item.movimento_id)
    if (!mov) continue
    const uf = (mov.uf_emitente || '—').toUpperCase()
    const cfop = item.cfop || '—'
    const chave = `${uf}|${cfop}`
    const atual =
      mapa.get(chave) ||
      ({
        uf,
        cfop,
        base_calculo: 0,
        valor_icms: 0,
        valor_icms_st: 0,
        valor_fcp_st: 0,
        valor_isentas: 0,
        valor_total: 0,
        quantidade_notas: 0,
      } as ResumoEstadoCfop)
    atual.base_calculo += item.valor_bc_icms || 0
    atual.valor_icms += item.valor_icms || 0
    atual.valor_icms_st += item.valor_icms_st || 0
    atual.valor_fcp_st += item.valor_fcp_st || 0
    atual.valor_isentas += item.valor_isentas || 0
    atual.valor_total += item.valor_total || 0
    atual.quantidade_notas += 1
    mapa.set(chave, atual)
  }
  return Array.from(mapa.values()).sort(
    (a, b) => a.uf.localeCompare(b.uf) || a.cfop.localeCompare(b.cfop),
  )
}

export interface ResumoServicosMunicipais {
  municipio: string
  item_lista_servico?: string
  descricao?: string
  base_calculo: number
  valor_iss: number
  valor_total: number
  quantidade_notas: number
}

/** Listagem de serviços municipais (NFS-e) da competência. */
export async function relatorioServicosMunicipais(params: {
  tenantId: string
  empresaId: string
  competencia: string
}): Promise<ResumoServicosMunicipais[]> {
  const movimentos = await listarMovimentos({
    tenantId: params.tenantId,
    empresaId: params.empresaId,
    competencia: params.competencia,
    tipoMovimento: 'servico_prestado',
  })
  const itens = await listarItensDeMovimentos(movimentos.map((m) => m.id))
  const porMov = new Map(movimentos.map((m) => [m.id, m]))

  const mapa = new Map<string, ResumoServicosMunicipais>()
  for (const item of itens) {
    const mov = porMov.get(item.movimento_id)
    if (!mov) continue
    const municipio = (mov.municipio_emitente || '—').toUpperCase()
    const itemLista = item.codigo_produto || '—'
    const chave = `${municipio}|${itemLista}`
    const atual =
      mapa.get(chave) ||
      ({
        municipio,
        item_lista_servico: itemLista,
        descricao: item.descricao,
        base_calculo: 0,
        valor_iss: 0,
        valor_total: 0,
        quantidade_notas: 0,
      } as ResumoServicosMunicipais)
    atual.base_calculo += item.valor_total || 0
    atual.valor_iss += 0 // ISS está no cabeçalho do movimento
    atual.valor_total += item.valor_total || 0
    atual.quantidade_notas += 1
    mapa.set(chave, atual)
  }

  // ISS vem no cabeçalho do movimento — somar por município
  for (const linha of mapa.values()) {
    linha.valor_iss = movimentos
      .filter((m) => (m.municipio_emitente || '—').toUpperCase() === linha.municipio)
      .reduce((s, m) => s + (m.valor_iss || 0), 0)
  }

  return Array.from(mapa.values()).sort((a, b) => a.municipio.localeCompare(b.municipio))
}

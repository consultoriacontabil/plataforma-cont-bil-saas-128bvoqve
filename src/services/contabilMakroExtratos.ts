/**
 * Conciliação bancária (OFX / TXT) da Fatia 4 Contábil — Makro.
 * Parse do extrato, persistência em `contabil_extratos` (mig 0164) e
 * geração de lançamentos em partida dobrada via `contabilService`.
 */

import pb from '@/lib/pocketbase/client'
import { contabilService, type CreatePartidaDobradaInput } from '@/services/contabil'
import { competenciaParaBase } from '@/services/contabilMakro'

export interface LinhaExtrato {
  data: string // AAAA-MM-DD
  descricao: string
  valor: number // crédito (+) ou débito (−)
  idUnico?: string
}

export function parseOfx(conteudo: string): LinhaExtrato[] {
  const linhas: LinhaExtrato[] = []
  const regexStmt = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  const regexTag = (bloco: string, tag: string) => {
    const m = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'))
    return m ? m[1].trim() : ''
  }

  let m: RegExpExecArray | null
  while ((m = regexStmt.exec(conteudo)) !== null) {
    const bloco = m[1]
    const dataBruta = regexTag(bloco, 'DTPOSTED').slice(0, 8) // AAAAMMDD
    const valorBruto = regexTag(bloco, 'TRNAMT').replace(',', '.')
    const nome = regexTag(bloco, 'NAME') || regexTag(bloco, 'MEMO') || 'Movimento do extrato'
    const fitid = regexTag(bloco, 'FITID')
    if (!dataBruta || !valorBruto) continue
    const valor = Number(valorBruto)
    if (Number.isNaN(valor)) continue
    linhas.push({
      data: `${dataBruta.slice(0, 4)}-${dataBruta.slice(4, 6)}-${dataBruta.slice(6, 8)}`,
      descricao: nome,
      valor,
      idUnico: fitid || undefined,
    })
  }
  return linhas
}

/**
 * Extrato TXT (layout simples de banco brasileiro), uma linha por movimento.
 * Aceita "DD/MM/AAAA;Descrição;-123.45" (separador ; tab ou espaço amplo).
 * O último campo é o valor numérico.
 */
export function parseExtratoTxt(conteudo: string): LinhaExtrato[] {
  const linhas: LinhaExtrato[] = []
  for (const raw of conteudo.split(/\r?\n/)) {
    const linha = raw.trim()
    if (!linha || /^(data|extrato|banc|conta)/i.test(linha)) continue
    const partes = linha
      .split(/;|\t| {2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (partes.length < 3) continue
    const dm = partes[0].match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!dm) continue
    const valor = Number(
      partes[partes.length - 1]
        .replace(/\s/g, '')
        .replace(/\.(?=\d{3}\b)/g, '')
        .replace(',', '.'),
    )
    if (Number.isNaN(valor)) continue
    linhas.push({
      data: `${dm[3]}-${dm[2]}-${dm[1]}`,
      descricao: partes.slice(1, partes.length - 1).join(' ') || 'Movimento do extrato',
      valor,
    })
  }
  return linhas
}

/** Tenta OFX primeiro e cai para TXT quando não há blocos <STMTTRN>. */
export function parseExtrato(conteudo: string): LinhaExtrato[] {
  return parseOfx(conteudo).length > 0 ? parseOfx(conteudo) : parseExtratoTxt(conteudo)
}

export interface ResultadoImportacaoExtrato {
  arquivo: string
  linhas: LinhaExtrato[]
  importadas: number
}

/**
 * Persiste as linhas do extrato em `contabil_extratos` (mig 0164) para
 * conciliação — não lança nada na contabilidade ainda.
 */
export async function importarExtrato(params: {
  tenantId: string
  empresaId: string
  nomeArquivo: string
  conteudo: string
  usuarioId?: string
}): Promise<ResultadoImportacaoExtrato> {
  const { tenantId, empresaId, nomeArquivo, conteudo, usuarioId } = params
  const linhas = parseExtrato(conteudo)
  if (linhas.length === 0) {
    throw new Error(
      'Nenhuma linha de extrato reconhecida. Verifique se o arquivo é OFX ou TXT bancário com data, descrição e valor.',
    )
  }
  const colecao = pb.collection('contabil_extratos')
  const existentes = await colecao.getFullList({
    filter: `tenant_id = "${tenantId}" && empresa_id = "${empresaId}" && arquivo_nome = "${nomeArquivo.replace(/"/g, '')}"`,
    limit: 1,
  })
  if (existentes.length > 0) {
    throw new Error(`O arquivo "${nomeArquivo}" já foi importado para esta empresa.`)
  }
  let importadas = 0
  for (const l of linhas) {
    await colecao.create({
      tenant_id: tenantId,
      empresa_id: empresaId,
      data: new Date(`${l.data}T12:00:00`).toISOString(),
      descricao: l.descricao,
      documento_numero: l.idUnico || undefined,
      valor: Math.abs(l.valor),
      tipo: l.valor >= 0 ? 'credito' : 'debito',
      status: 'pendente',
      arquivo_nome: nomeArquivo,
      usuario_id: usuarioId || undefined,
    })
    importadas++
  }
  return { arquivo: nomeArquivo, linhas, importadas }
}

export async function listarExtratosPendentes(tenantId: string, empresaId: string) {
  return pb.collection('contabil_extratos').getFullList<{
    id: string
    data: string
    descricao: string
    documento_numero?: string
    valor: number
    tipo: 'credito' | 'debito'
    status: string
    arquivo_nome?: string
  }>({
    filter: `tenant_id = "${tenantId}" && empresa_id = "${empresaId}" && status = "pendente"`,
    sort: 'data',
  })
}

export async function marcarExtratoConciliado(id: string, status: 'conciliado' | 'ignorado') {
  return pb.collection('contabil_extratos').update(id, { status })
}

// ---------------------------------------------------------------------------
// Conciliação (API usada pelas fases Lançamentos da Fatia 4)
// ---------------------------------------------------------------------------

export interface TransacaoConciliada {
  data: string // AAAA-MM-DD
  descricao: string
  valor: number // + entrada / − saída
}

export interface ResultadoConciliacao {
  /** Transações do extrato que casaram com lançamentos já escriturados. */
  conciliadas: number
  /** Transações sem lançamento correspondente — podem gerar lançamentos. */
  novas: TransacaoConciliada[]
  saldoFinal: number
}

/**
 * Concilia o extrato com os lançamentos da competência: para cada linha do
 * extrato procura um lançamento confirmado na mesma data com o mesmo valor
 * (entrada = crédito no extrato; saída = débito). O extrato é apenas lido —
 * a persistência/geração acontece em `gerarLancamentosDaConciliacao`.
 */
export async function conciliarExtrato(params: {
  texto: string
  tenantId: string
  empresaId: string
  competencia: string // AAAA-MM
  contaBancariaId: string
}): Promise<ResultadoConciliacao> {
  const transacoes = parseExtrato(params.texto)
  const comp = competenciaParaBase(params.competencia)
  const escriturados = await contabilService.listLancamentos(
    params.tenantId,
    { empresaId: params.empresaId, competencia: comp },
    1,
    500,
  )

  const usados = new Set<string>()
  let conciliadas = 0
  const novas: TransacaoConciliada[] = []
  let saldoFinal = 0

  for (const t of transacoes) {
    saldoFinal += t.valor
    const match = escriturados.items.find(
      (l) =>
        l.status === 'confirmado' &&
        !usados.has(l.id) &&
        l.data.slice(0, 10) === t.data &&
        Math.abs(l.valor - Math.abs(t.valor)) < 0.005,
    )
    if (match) {
      usados.add(match.id)
      conciliadas++
    } else {
      novas.push({ data: t.data, descricao: t.descricao, valor: t.valor })
    }
  }

  return { conciliadas, novas, saldoFinal }
}

/**
 * Gera lançamentos em partida dobrada a partir do resultado da conciliação:
 * entrada debita a conta bancária e credita a contrapartida; saída é o inverso.
 */
export async function gerarLancamentosDaConciliacao(params: {
  tenantId: string
  empresaId: string
  competencia: string // AAAA-MM
  contaBancariaId: string
  contaContrapartidaId: string
  usuarioId?: string
  resultado: ResultadoConciliacao
}): Promise<{ loteId: string; quantidade: number }> {
  const {
    tenantId,
    empresaId,
    competencia,
    contaBancariaId,
    contaContrapartidaId,
    usuarioId,
    resultado,
  } = params
  const novas = resultado.novas.filter((t) => Math.abs(t.valor) > 0)
  if (novas.length === 0) {
    throw new Error('Nenhuma transação nova para gerar lançamentos.')
  }

  const loteId = `CONC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const base: Omit<
    CreatePartidaDobradaInput,
    'debitoContaId' | 'creditoContaId' | 'valor' | 'historico' | 'data'
  > = {
    tenant_id: tenantId,
    empresa: empresaId,
    competencia: competenciaParaBase(competencia),
    status: 'confirmado',
    loteId,
    origem: 'importacao',
    criado_por: usuarioId,
  }

  let quantidade = 0
  for (const t of novas) {
    const isEntrada = t.valor >= 0
    await contabilService.createPartidaDobrada({
      ...base,
      data: t.data,
      valor: Math.abs(t.valor),
      historico: `Extrato bancário — ${t.descricao}`,
      debitoContaId: isEntrada ? contaBancariaId : contaContrapartidaId,
      creditoContaId: isEntrada ? contaContrapartidaId : contaBancariaId,
    })
    quantidade++
  }

  return { loteId, quantidade }
}

/**
 * Gera lançamentos em partida dobrada a partir de linhas de extrato
 * pendentes selecionadas. Entrada de dinheiro (crédito no extrato) =
 * debita Bancos / credita a conta indicada; saída = o inverso.
 */
export async function gerarLancamentosDeExtrato(params: {
  tenantId: string
  empresaId: string
  contaBancoId: string
  contaContrapartidaId: string
  competencia: string // AAAA-MM
  usuarioId?: string
  extratoIds: string[]
}): Promise<{ loteId: string; quantidade: number }> {
  const { tenantId, empresaId, contaBancoId, contaContrapartidaId, competencia, usuarioId } = params
  const colecao = pb.collection('contabil_extratos')
  const alvo = await colecao.getFullList<{
    id: string
    data: string
    descricao: string
    valor: number
    tipo: 'credito' | 'debito'
  }>({
    filter: `tenant_id = "${tenantId}" && empresa_id = "${empresaId}" && status = "pendente"`,
    sort: 'data',
  })
  const selecionadas = alvo.filter((x) => params.extratoIds.includes(x.id))
  if (selecionadas.length === 0) {
    throw new Error('Selecione ao menos uma linha de extrato para gerar lançamentos.')
  }

  const loteId = `OFX-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const entradaBase: Omit<
    CreatePartidaDobradaInput,
    'debitoContaId' | 'creditoContaId' | 'valor' | 'historico' | 'data'
  > = {
    tenant_id: tenantId,
    empresa: empresaId,
    competencia: competenciaParaBase(competencia),
    status: 'confirmado',
    loteId,
    origem: 'importacao',
    criado_por: usuarioId,
  }

  let quantidade = 0
  for (const linha of selecionadas) {
    const isEntrada = linha.tipo === 'credito'
    await contabilService.createPartidaDobrada({
      ...entradaBase,
      data: linha.data,
      valor: linha.valor,
      historico: `Extrato bancário — ${linha.descricao}`,
      debitoContaId: isEntrada ? contaBancoId : contaContrapartidaId,
      creditoContaId: isEntrada ? contaContrapartidaId : contaBancoId,
    })
    await colecao.update(linha.id, {
      status: 'conciliado',
      lote_contabil_id: loteId,
    })
    quantidade++
  }

  return { loteId, quantidade }
}

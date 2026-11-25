/**
 * Núcleo do módulo Financeiro do Escritório (Fatia 3 Makro).
 *
 * Gestão financeira INTERNA do escritório contábil (não dos clientes):
 * - contas de caixa/bancos do escritório com saldo calculado;
 * - categorias de receita/despesa (seed padrão na migration 0163);
 * - honorários mensais fixos por cliente (empresa) — leitura opcional dos
 *   contratos existentes em /contratos (tab faturamento) para pré-cadastro;
 * - títulos a receber/a pagar (gerados em lote a partir dos honorários ou
 *   avulsos), com baixa que alimenta o extrato de caixa/banco;
 * - DRE gerencial do escritório e comparativo esperado vs cobrado/recebido.
 */

import pb from '@/lib/pocketbase/client'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type TipoConta = 'caixa' | 'banco' | 'pix'
export type TipoCategoria = 'receita' | 'despesa'
export type TipoTitulo = 'receber' | 'pagar'
export type StatusTitulo = 'aberto' | 'pago'
export type OrigemTitulo =
  | 'honorario_fixo'
  | 'receita_avulsa'
  | 'despesa_fixa'
  | 'despesa_avulsa'
  | 'manual'
export type NaturezaMovimento = 'entrada' | 'saida'

export interface ContaEscritorio {
  id: string
  tenant_id: string
  nome: string
  tipo: TipoConta
  agencia?: string
  conta_numero?: string
  saldo_inicial?: number
  ativo?: boolean
  created: string
}

export interface CategoriaFinanceira {
  id: string
  tenant_id: string
  nome: string
  tipo: TipoCategoria
  descricao?: string
  cor?: string
}

export interface HonorarioFixo {
  id: string
  tenant_id: string
  empresa_id: string
  descricao?: string
  valor_mensal: number
  dia_vencimento?: number
  ativo?: boolean
  origem: 'manual' | 'contrato'
  contrato_id?: string
  created: string
  expand?: { empresa_id?: { id: string; nome_fantasia?: string; razao_social?: string } }
}

export interface TituloFinanceiro {
  id: string
  tenant_id: string
  empresa_id: string
  tipo: TipoTitulo
  origem: OrigemTitulo
  status: StatusTitulo
  descricao: string
  competencia: string // AAAA-MM
  vencimento?: string
  valor: number
  data_baixa?: string
  valor_baixado?: number
  conta_id?: string
  categoria_id?: string
  honorario_id?: string
  created: string
  expand?: {
    empresa_id?: { id: string; nome_fantasia?: string; razao_social?: string }
    conta_id?: { id: string; nome: string }
    categoria_id?: { id: string; nome: string; tipo: TipoCategoria }
  }
}

export interface MovimentoCaixa {
  id: string
  tenant_id: string
  conta_id: string
  titulo_id?: string
  natureza: NaturezaMovimento
  descricao: string
  competencia: string
  data?: string
  valor: number
  categoria_id?: string
  created: string
  expand?: {
    conta_id?: { id: string; nome: string; tipo: TipoConta }
    categoria_id?: { id: string; nome: string }
    titulo_id?: { id: string; descricao: string }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Competência atual no formato AAAA-MM (fuso local). */
export function competenciaAtualEscritorio(): string {
  const hoje = new Date()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  return `${hoje.getFullYear()}-${mes}`
}

/** Data AAAA-MM-DD a partir de competência AAAA-MM + dia (clamp no fim do mês). */
function dataDeCompetencia(competencia: string, dia: number): string {
  const [ano, mes] = competencia.split('-').map(Number)
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const d = Math.min(Math.max(1, dia), ultimoDia)
  return `${competencia}-${String(d).padStart(2, '0')}`
}

/** Data ISO completa (PocketBase date) a partir de AAAA-MM-DD. */
function isoDeDia(dia: string): string {
  return `${dia} 12:00:00.000Z`
}

function nomeEmpresa(expand?: TituloFinanceiro['expand'] | HonorarioFixo['expand']): string {
  const e = expand?.empresa_id
  if (!e) return '—'
  return e.nome_fantasia || e.razao_social || '—'
}

// ---------------------------------------------------------------------------
// Contas (caixa e bancos do escritório)
// ---------------------------------------------------------------------------

export async function listarContas(tenantId: string): Promise<ContaEscritorio[]> {
  const res = await pb.collection('financeiro_contas').getFullList({
    filter: `tenant_id="${tenantId}"`,
    sort: 'nome',
  })
  return res as unknown as ContaEscritorio[]
}

export async function criarConta(dados: {
  tenantId: string
  usuarioId: string
  nome: string
  tipo: TipoConta
  agencia?: string
  contaNumero?: string
  saldoInicial?: number
}): Promise<ContaEscritorio> {
  return (await pb.collection('financeiro_contas').create({
    tenant_id: dados.tenantId,
    usuario_id: dados.usuarioId,
    nome: dados.nome,
    tipo: dados.tipo,
    agencia: dados.agencia || '',
    conta_numero: dados.contaNumero || '',
    saldo_inicial: dados.saldoInicial ?? 0,
    ativo: true,
  })) as unknown as ContaEscritorio
}

export async function atualizarConta(
  id: string,
  dados: Partial<{ nome: string; tipo: TipoConta; ativo: boolean; saldo_inicial: number }>,
): Promise<void> {
  await pb.collection('financeiro_contas').update(id, dados)
}

export async function excluirConta(id: string): Promise<void> {
  await pb.collection('financeiro_contas').delete(id)
}

/** Saldo de uma conta = saldo_inicial + entradas − saídas (todos os tempos). */
export function saldoDaConta(conta: ContaEscritorio, movimentos: MovimentoCaixa[]): number {
  const movsDaConta = movimentos.filter((m) => m.conta_id === conta.id)
  const liquido = movsDaConta.reduce(
    (acc, m) => acc + (m.natureza === 'entrada' ? m.valor : -m.valor),
    0,
  )
  return (conta.saldo_inicial ?? 0) + liquido
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export async function listarCategorias(tenantId: string): Promise<CategoriaFinanceira[]> {
  const res = await pb.collection('financeiro_categorias').getFullList({
    filter: `tenant_id="${tenantId}"`,
    sort: 'nome',
  })
  return res as unknown as CategoriaFinanceira[]
}

export async function criarCategoria(dados: {
  tenantId: string
  nome: string
  tipo: TipoCategoria
  descricao?: string
}): Promise<CategoriaFinanceira> {
  return (await pb.collection('financeiro_categorias').create({
    tenant_id: dados.tenantId,
    nome: dados.nome,
    tipo: dados.tipo,
    descricao: dados.descricao || '',
  })) as unknown as CategoriaFinanceira
}

// ---------------------------------------------------------------------------
// Honorários fixos
// ---------------------------------------------------------------------------

export async function listarHonorarios(params: {
  tenantId: string
  apenasAtivos?: boolean
}): Promise<HonorarioFixo[]> {
  const filtros = [`tenant_id="${params.tenantId}"`]
  if (params.apenasAtivos) filtros.push('ativo=true')
  const res = await pb.collection('financeiro_honorarios').getFullList({
    filter: filtros.join(' && '),
    sort: '-created',
    expand: 'empresa_id',
  })
  return res as unknown as HonorarioFixo[]
}

/** Honorários já existentes na carteira (por tenant) — mesmo registro que os contratos usam. */
export interface HonorarioContrato {
  id: string
  empresa_id: string
  valor_mensal: number
  dia_vencimento?: number
  ativo?: boolean
  descricao?: string
}

export async function buscarHonorariosDeContratos(tenantId: string): Promise<HonorarioContrato[]> {
  try {
    const res = await pb.collection('contratos_honorarios').getFullList({
      filter: `tenant_id="${tenantId}" && status="assinado"`,
      sort: '-created',
      expand: 'empresa',
    })
    return (res as unknown as Array<Record<string, any>>)
      .filter((c) => c.empresa && Number(c.valor_mensal || 0) > 0)
      .map((c) => ({
        id: c.id,
        empresa_id: typeof c.empresa === 'string' ? c.empresa : c.empresa?.id,
        valor_mensal: Number(c.valor_mensal ?? 0),
        dia_vencimento: c.dia_vencimento ? Number(c.dia_vencimento) : 10,
        ativo: true,
        descricao: c.titulo || 'Honorário de contrato',
      }))
  } catch {
    return []
  }
}

export async function criarHonorario(dados: {
  tenantId: string
  usuarioId: string
  empresaId: string
  descricao?: string
  valorMensal: number
  diaVencimento?: number
  origem?: 'manual' | 'contrato'
  contratoId?: string
}): Promise<HonorarioFixo> {
  return (await pb.collection('financeiro_honorarios').create({
    tenant_id: dados.tenantId,
    empresa_id: dados.empresaId,
    usuario_id: dados.usuarioId,
    descricao: dados.descricao || '',
    valor_mensal: dados.valorMensal,
    dia_vencimento: dados.diaVencimento ?? 10,
    ativo: true,
    origem: dados.origem || 'manual',
    contrato_id: dados.contratoId || '',
  })) as unknown as HonorarioFixo
}

export async function atualizarHonorario(
  id: string,
  dados: Partial<{
    descricao: string
    valor_mensal: number
    dia_vencimento: number
    ativo: boolean
  }>,
): Promise<void> {
  await pb.collection('financeiro_honorarios').update(id, dados)
}

export async function excluirHonorario(id: string): Promise<void> {
  await pb.collection('financeiro_honorarios').delete(id)
}

// ---------------------------------------------------------------------------
// Títulos (a receber / a pagar)
// ---------------------------------------------------------------------------

export async function listarTitulos(params: {
  tenantId: string
  competencia?: string
  tipo?: TipoTitulo
  status?: StatusTitulo
}): Promise<TituloFinanceiro[]> {
  const filtros = [`tenant_id="${params.tenantId}"`]
  if (params.competencia) filtros.push(`competencia="${params.competencia}"`)
  if (params.tipo) filtros.push(`tipo="${params.tipo}"`)
  if (params.status) filtros.push(`status="${params.status}"`)
  const res = await pb.collection('financeiro_titulos').getFullList({
    filter: filtros.join(' && '),
    sort: 'vencimento',
    expand: 'empresa_id,conta_id,categoria_id',
  })
  return res as unknown as TituloFinanceiro[]
}

export async function criarTitulo(dados: {
  tenantId: string
  usuarioId: string
  empresaId: string
  tipo: TipoTitulo
  origem?: OrigemTitulo
  descricao: string
  competencia: string
  vencimento?: string
  valor: number
  categoriaId?: string
  contaId?: string
  honorarioId?: string
}): Promise<TituloFinanceiro> {
  return (await pb.collection('financeiro_titulos').create({
    tenant_id: dados.tenantId,
    empresa_id: dados.empresaId,
    usuario_id: dados.usuarioId,
    tipo: dados.tipo,
    origem: dados.origem || 'manual',
    status: 'aberto',
    descricao: dados.descricao,
    competencia: dados.competencia,
    vencimento: dados.vencimento ? isoDeDia(dados.vencimento) : undefined,
    valor: dados.valor,
    categoria_id: dados.categoriaId || '',
    conta_id: dados.contaId || '',
    honorario_id: dados.honorarioId || '',
  })) as unknown as TituloFinanceiro
}

export async function excluirTitulo(id: string): Promise<void> {
  await pb.collection('financeiro_titulos').delete(id)
}

export interface ResultadoGeracaoLote {
  criados: number
  ignorados: number
}

/**
 * Geração em massa dos títulos A RECEBER do mês a partir dos honorários fixos ativos.
 * Idempotente: não duplica honorário já gerado na competência (por honorario_id+competência).
 */
export async function gerarTitulosDoMes(params: {
  tenantId: string
  usuarioId: string
  competencia: string
}): Promise<ResultadoGeracaoLote> {
  const honorarios = await listarHonorarios({ tenantId: params.tenantId, apenasAtivos: true })
  if (honorarios.length === 0) return { criados: 0, ignorados: 0 }

  const existentes = await pb.collection('financeiro_titulos').getFullList({
    filter: `tenant_id="${params.tenantId}" && tipo="receber" && competencia="${params.competencia}" && honorario_id!=""`,
    fields: 'honorario_id',
  })
  const jaGerados = new Set(
    (existentes as unknown as Array<{ honorario_id?: string }>).map((t) => t.honorario_id),
  )

  let criados = 0
  let ignorados = 0
  for (const h of honorarios) {
    if (!h.empresa_id || jaGerados.has(h.id) || !(h.valor_mensal > 0)) {
      ignorados++
      continue
    }
    await criarTitulo({
      tenantId: params.tenantId,
      usuarioId: params.usuarioId,
      empresaId: h.empresa_id,
      tipo: 'receber',
      origem: 'honorario_fixo',
      descricao: h.descricao || 'Honorário mensal',
      competencia: params.competencia,
      vencimento: dataDeCompetencia(params.competencia, h.dia_vencimento ?? 10),
      valor: h.valor_mensal,
      honorarioId: h.id,
    })
    criados++
  }
  return { criados, ignorados }
}

// ---------------------------------------------------------------------------
// Baixa de títulos + movimentação de caixa
// ---------------------------------------------------------------------------

/**
 * Dá baixa em um título (recebimento ou pagamento) e lança a movimentação
 * correspondente no caixa/banco. Se já houver movimento do título (rebaixa),
 * atualiza o existente em vez de duplicar.
 */
export async function baixarTitulo(params: {
  titulo: TituloFinanceiro
  usuarioId: string
  contaId: string
  dataBaixa?: string
  valorBaixado?: number
}): Promise<void> {
  const { titulo } = params
  const valor = params.valorBaixado ?? titulo.valor
  const data = params.dataBaixa || new Date().toISOString().slice(0, 10)

  const existentes = await pb.collection('financeiro_movimentos').getFullList({
    filter: `tenant_id="${titulo.tenant_id}" && titulo_id="${titulo.id}"`,
    limit: 1,
  })
  const movimentoExistente = (existentes as unknown as MovimentoCaixa[])[0]

  const payloadMovimento = {
    tenant_id: titulo.tenant_id,
    conta_id: params.contaId,
    titulo_id: titulo.id,
    natureza: (titulo.tipo === 'receber' ? 'entrada' : 'saida') as NaturezaMovimento,
    descricao: titulo.descricao,
    competencia: titulo.competencia,
    data: isoDeDia(data),
    valor,
    categoria_id: titulo.categoria_id || '',
    usuario_id: params.usuarioId,
  }

  if (movimentoExistente) {
    await pb.collection('financeiro_movimentos').update(movimentoExistente.id, payloadMovimento)
  } else {
    await pb.collection('financeiro_movimentos').create(payloadMovimento)
  }

  await pb.collection('financeiro_titulos').update(titulo.id, {
    status: 'pago',
    data_baixa: isoDeDia(data),
    valor_baixado: valor,
    conta_id: params.contaId,
  })
}

/** Reabre um título pago e remove o movimento de caixa correspondente. */
export async function reabrirTitulo(titulo: TituloFinanceiro): Promise<void> {
  const existentes = await pb.collection('financeiro_movimentos').getFullList({
    filter: `tenant_id="${titulo.tenant_id}" && titulo_id="${titulo.id}"`,
  })
  for (const m of existentes as unknown as MovimentoCaixa[]) {
    await pb.collection('financeiro_movimentos').delete(m.id)
  }
  await pb.collection('financeiro_titulos').update(titulo.id, {
    status: 'aberto',
    data_baixa: null,
    valor_baixado: 0,
  })
}

// ---------------------------------------------------------------------------
// Movimentos de caixa (lançamento avulso)
// ---------------------------------------------------------------------------

export async function listarMovimentos(params: {
  tenantId: string
  competencia?: string
  contaId?: string
}): Promise<MovimentoCaixa[]> {
  const filtros = [`tenant_id="${params.tenantId}"`]
  if (params.competencia) filtros.push(`competencia="${params.competencia}"`)
  if (params.contaId) filtros.push(`conta_id="${params.contaId}"`)
  const res = await pb.collection('financeiro_movimentos').getFullList({
    filter: filtros.join(' && '),
    sort: '-data,-created',
    expand: 'conta_id,categoria_id,titulo_id',
  })
  return res as unknown as MovimentoCaixa[]
}

export async function criarMovimentoAvulso(dados: {
  tenantId: string
  usuarioId: string
  contaId: string
  natureza: NaturezaMovimento
  descricao: string
  competencia: string
  data?: string
  valor: number
  categoriaId?: string
}): Promise<MovimentoCaixa> {
  return (await pb.collection('financeiro_movimentos').create({
    tenant_id: dados.tenantId,
    conta_id: dados.contaId,
    titulo_id: '',
    natureza: dados.natureza,
    descricao: dados.descricao,
    competencia: dados.competencia,
    data: isoDeDia(dados.data || new Date().toISOString().slice(0, 10)),
    valor: dados.valor,
    categoria_id: dados.categoriaId || '',
    usuario_id: dados.usuarioId,
  })) as unknown as MovimentoCaixa
}

export async function excluirMovimento(id: string): Promise<void> {
  await pb.collection('financeiro_movimentos').delete(id)
}

// ---------------------------------------------------------------------------
// Resultados: DRE gerencial + análise evolutiva
// ---------------------------------------------------------------------------

export interface LinhaDre {
  categoriaId: string
  categoria: string
  valor: number
}

export interface DreEscritorio {
  competencia: string
  receitaHonorarios: number
  receitaOutras: number
  receitaTotal: number
  despesasPorCategoria: LinhaDre[]
  despesaTotal: number
  resultado: number
  margem: number // %
}

export interface AnaliseEvolutivaMes {
  competencia: string
  esperado: number // honorários fixos ativos no mês
  cobrado: number // títulos a receber gerados
  recebido: number // títulos com baixa
}

export function calcularDre(
  competencia: string,
  titulos: TituloFinanceiro[],
  movimentos: MovimentoCaixa[],
): DreEscritorio {
  const receitaPorCategoria = new Map<string, { nome: string; valor: number }>()
  const despesaPorCategoria = new Map<string, { nome: string; valor: number }>()

  let receitaHonorarios = 0
  let receitaOutras = 0
  let despesaTotal = 0

  // DRE considera o REALIZADO: valores efetivamente baixados (caixa) no período.
  for (const t of titulos) {
    if (t.status !== 'pago') continue
    const valor = Number(t.valor_baixado ?? t.valor) || 0
    const nomeCat =
      t.expand?.categoria_id?.nome ||
      (t.tipo === 'receber' ? 'Honorários contábeis' : 'Outras despesas')
    if (t.tipo === 'receber') {
      if (t.origem === 'honorario_fixo') receitaHonorarios += valor
      else receitaOutras += valor
      const atual = receitaPorCategoria.get(nomeCat) || { nome: nomeCat, valor: 0 }
      atual.valor += valor
      receitaPorCategoria.set(nomeCat, atual)
    } else {
      despesaTotal += valor
      const atual = despesaPorCategoria.get(nomeCat) || { nome: nomeCat, valor: 0 }
      atual.valor += valor
      despesaPorCategoria.set(nomeCat, atual)
    }
  }

  // Movimentos avulsos (sem título) entram também no realizado.
  for (const m of movimentos) {
    if (m.titulo_id) continue
    const nomeCat = m.expand?.categoria_id?.nome || 'Sem categoria'
    if (m.natureza === 'entrada') {
      receitaOutras += m.valor
      const atual = receitaPorCategoria.get(nomeCat) || { nome: nomeCat, valor: 0 }
      atual.valor += m.valor
      receitaPorCategoria.set(nomeCat, atual)
    } else {
      despesaTotal += m.valor
      const atual = despesaPorCategoria.get(nomeCat) || { nome: nomeCat, valor: 0 }
      atual.valor += m.valor
      despesaPorCategoria.set(nomeCat, atual)
    }
  }

  const receitaTotal = receitaHonorarios + receitaOutras
  const resultado = receitaTotal - despesaTotal
  const margem = receitaTotal > 0 ? (resultado / receitaTotal) * 100 : 0

  return {
    competencia,
    receitaHonorarios,
    receitaOutras,
    receitaTotal,
    despesasPorCategoria: [...despesaPorCategoria.values()].sort((a, b) => b.valor - a.valor),
    despesaTotal,
    resultado,
    margem,
  }
}

/** Análise evolutiva dos últimos N meses (esperado × cobrado × recebido). */
export async function calcularAnaliseEvolutiva(params: {
  tenantId: string
  meses: number // quantidade de meses retroativos a partir do mês atual
}): Promise<AnaliseEvolutivaMes[]> {
  const meses: string[] = []
  const hoje = new Date()
  for (let i = params.meses - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const titulos = await pb.collection('financeiro_titulos').getFullList({
    filter: `tenant_id="${params.tenantId}" && tipo="receber" && competencia>="${meses[0]}" && competencia<="${meses[meses.length - 1]}"`,
  })
  const lista = titulos as unknown as TituloFinanceiro[]

  return meses.map((comp) => {
    const doMes = lista.filter((t) => t.competencia === comp)
    const cobrado = doMes.reduce((acc, t) => acc + (Number(t.valor) || 0), 0)
    const recebido = doMes
      .filter((t) => t.status === 'pago')
      .reduce((acc, t) => acc + (Number(t.valor_baixado ?? t.valor) || 0), 0)
    return { competencia: comp, esperado: 0, cobrado, recebido }
  })
}

export { nomeEmpresa }

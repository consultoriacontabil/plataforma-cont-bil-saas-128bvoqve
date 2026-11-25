/**
 * Service contábil do modelo Makro (Fatia 4).
 *
 * Constrói os demonstrativos da competência a partir do service base
 * (`contabilService.getBalancete`) e dos lançamentos já escriturados:
 *  - Livro Diário        — lançamentos cronológicos em partida dobrada
 *  - Livro Razão         — extrato por conta (débitos/créditos/contrapartida)
 *  - Balancete           — reuso direto do service base
 *  - Balanço Patrimonial — agrupamento Ativo/Passivo/PL por classificação
 *  - DRE                 — receitas − despesas = resultado da competência
 *  - Fechamento          — grava/atualiza contabil_fechamentos (mig 0164)
 *
 * A conciliação OFX/TXT vive em `contabilMakroExtratos.ts`.
 * Não recria collections: plano_contas, lancamentos_contabeis e
 * fechamento_competencia já existem (migs 0006/0085/0132/0143).
 */

import pb from '@/lib/pocketbase/client'
import { contabilService } from '@/services/contabil'
import type { BalanceteItem, ContaTipo } from '@/types'

// ---------------------------------------------------------------------------
// Helpers de competência (a base usa "MM/YYYY"; a UI Makro usa "AAAA-MM")
// ---------------------------------------------------------------------------

export function competenciaAtualMakro(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** "2025-06" -> "06/2025" (formato do service base) */
export function competenciaParaBase(makro: string): string {
  const [ano, mes] = makro.split('-')
  if (!ano || !mes) return makro
  return `${mes}/${ano}`
}

/** "06/2025" -> "2025-06" (formato da UI Makro) */
export function competenciaDaBase(base: string): string {
  const [mes, ano] = base.split('/')
  if (!mes || !ano) return base
  return `${ano}-${mes}`
}

// ---------------------------------------------------------------------------
// Livro Diário
// ---------------------------------------------------------------------------

export interface ItemDiario {
  id: string
  data: string
  loteId: string
  historico: string
  origem: string
  debitoCodigo: string
  debitoNome: string
  creditoCodigo: string
  creditoNome: string
  valor: number
}

export async function livroDiario(
  tenantId: string,
  empresaId: string,
  competenciaMakro: string,
): Promise<ItemDiario[]> {
  const comp = competenciaParaBase(competenciaMakro)
  const res = await contabilService.listLancamentos(
    tenantId,
    { empresaId, competencia: comp },
    1,
    500,
  )
  return res.items.map((l) => ({
    id: l.id,
    data: l.data,
    loteId: l.lote_id || '—',
    historico: l.historico,
    origem: l.origem || 'manual',
    debitoCodigo: l.expand?.conta_contabil?.codigo || '—',
    debitoNome: l.expand?.conta_contabil?.nome || '—',
    creditoCodigo: l.expand?.contrapartida?.codigo || '—',
    creditoNome: l.expand?.contrapartida?.nome || '—',
    valor: l.valor,
  }))
}

// ---------------------------------------------------------------------------
// Livro Razão
// ---------------------------------------------------------------------------

export interface ItemRazaoLinha {
  data: string
  historico: string
  contrapartida: string
  tipo: 'debito' | 'credito'
  valor: number
  saldoAcumulado: number
}

export interface ItemRazao {
  contaId: string
  codigo: string
  nome: string
  saldoInicial: number
  linhas: ItemRazaoLinha[]
  saldoFinal: number
}

export async function livroRazao(
  tenantId: string,
  empresaId: string,
  competenciaMakro: string,
): Promise<ItemRazao[]> {
  const comp = competenciaParaBase(competenciaMakro)
  const res = await contabilService.listLancamentos(
    tenantId,
    { empresaId, competencia: comp },
    1,
    500,
  )

  const porConta = new Map<string, ItemRazao>()
  const contaMeta = new Map<string, { codigo: string; nome: string }>()

  for (const l of res.items) {
    const cc = l.expand?.conta_contabil
    const cp = l.expand?.contrapartida
    if (cc && !contaMeta.has(cc.id)) contaMeta.set(cc.id, { codigo: cc.codigo, nome: cc.nome })
    if (cp && !contaMeta.has(cp.id)) contaMeta.set(cp.id, { codigo: cp.codigo, nome: cp.nome })
  }

  // Metadados e saldo inicial vêm da mesma fonte do Balancete
  const balancete = await contabilService.getBalancete(tenantId, empresaId, comp)
  for (const it of balancete.itens) {
    contaMeta.set(it.id, { codigo: it.codigo, nome: it.nome })
  }

  // Natureza da conta: determina se débito aumenta ou diminui o saldo
  const contaTipo = new Map<string, ContaTipo>()
  for (const it of balancete.itens) contaTipo.set(it.id, it.tipo)
  // Contas sem registro no balancete: natureza pela raiz do código
  // 1 = ativo, 2 = passivo, 3 = PL, 4 = despesa, 5/7 = receita (padrão Makro)
  for (const [id, meta] of contaMeta) {
    if (!contaTipo.has(id)) contaTipo.set(id, naturezaPorCodigo(meta.codigo))
  }

  // Ordena cronologicamente para acumular o saldo
  const cronologico = [...res.items].sort((a, b) => {
    const da = new Date(a.data).getTime()
    const db = new Date(b.data).getTime()
    if (da !== db) return da - db
    return (a.created || '').localeCompare(b.created || '')
  })

  for (const l of cronologico) {
    const ids = new Set<string>([l.conta_contabil])
    if (l.contrapartida) ids.add(l.contrapartida)
    for (const contaId of ids) {
      if (!contaId) continue
      if (!porConta.has(contaId)) {
        const meta = contaMeta.get(contaId)
        const bal = balancete.itens.find((i) => i.id === contaId)
        porConta.set(contaId, {
          contaId,
          codigo: meta?.codigo || '—',
          nome: meta?.nome || 'Conta sem plano',
          saldoInicial: bal?.saldoAnterior || 0,
          linhas: [],
          saldoFinal: bal?.saldoAnterior || 0,
        })
      }
      const conta = porConta.get(contaId)!
      const natureza = contaTipo.get(contaId) || 'ativo'
      const devedora = natureza === 'ativo' || natureza === 'despesa'
      const eDebito = l.tipo === 'debito'
      conta.saldoFinal += eDebito === devedora ? l.valor : -l.valor

      const contraId = eDebito ? l.contrapartida : l.conta_contabil
      const contraMeta = contraId ? contaMeta.get(contraId) : undefined
      conta.linhas.push({
        data: l.data,
        historico: l.historico,
        contrapartida: contraMeta?.codigo || contraId || '—',
        tipo: eDebito ? 'debito' : 'credito',
        valor: l.valor,
        saldoAcumulado: conta.saldoFinal,
      })
    }
  }

  return [...porConta.values()].sort((a, b) =>
    a.codigo.localeCompare(b.codigo, undefined, { numeric: true }),
  )
}

/** Raiz do código -> tipo de conta (plano Makro 1/2/3/4/5). */
function naturezaPorCodigo(codigo: string): ContaTipo {
  switch (codigo.charAt(0)) {
    case '1':
      return 'ativo'
    case '2':
      return 'passivo'
    case '3':
      return 'patrimonio'
    case '4':
      return 'despesa'
    default:
      return 'receita'
  }
}

// ---------------------------------------------------------------------------
// Balanço Patrimonial e DRE (a partir do Balancete)
// ---------------------------------------------------------------------------

export interface BalancoPatrimonial {
  ativo: BalanceteItem[]
  passivo: BalanceteItem[]
  patrimonioLiquido: BalanceteItem[]
  totalAtivo: number
  totalPassivo: number
  totalPatrimonioLiquido: number
  resultadoPeriodo: number // receitas − despesas (positivo = lucro)
  totalPassivoMaisPL: number
  diferenca: number
}

export async function balancoPatrimonial(
  tenantId: string,
  empresaId: string,
  competenciaMakro: string,
): Promise<BalancoPatrimonial> {
  const comp = competenciaParaBase(competenciaMakro)
  const bal = await contabilService.getBalancete(tenantId, empresaId, comp)

  const ativo: BalanceteItem[] = []
  const passivo: BalanceteItem[] = []
  const patrimonioLiquido: BalanceteItem[] = []
  let receitas = 0
  let despesas = 0

  for (const it of bal.itens) {
    if (it.isSintetica) continue // soma nas analíticas, evita dupla contagem
    if (it.tipo === 'ativo') ativo.push(it)
    else if (it.tipo === 'passivo') passivo.push(it)
    else if (it.tipo === 'patrimonio') patrimonioLiquido.push(it)
    else if (it.tipo === 'receita') receitas += it.saldoAtual
    else if (it.tipo === 'despesa') despesas += it.saldoAtual
  }

  const totalAtivo = arred(ativo.reduce((s, i) => s + i.saldoAtual, 0))
  const totalPassivo = arred(passivo.reduce((s, i) => s + i.saldoAtual, 0))
  const totalPLBase = arred(patrimonioLiquido.reduce((s, i) => s + i.saldoAtual, 0))
  const resultado = arred(receitas - despesas)
  // O resultado da competência ainda não está em conta de PL: soma-se ao PL
  const totalPL = arred(totalPLBase + resultado)
  const totalPassivoMaisPL = arred(totalPassivo + totalPL)

  return {
    ativo: ordenar(ativo),
    passivo: ordenar(passivo),
    patrimonioLiquido: ordenar(patrimonioLiquido),
    totalAtivo,
    totalPassivo,
    totalPatrimonioLiquido: totalPL,
    resultadoPeriodo: resultado,
    totalPassivoMaisPL,
    diferenca: arred(totalAtivo - totalPassivoMaisPL),
  }
}

export interface LinhaDre {
  descricao: string
  valor: number
  nivel: 'total' | 'grupo' | 'item'
}

export interface Dre {
  linhas: LinhaDre[]
  receitas: number
  despesas: number
  resultado: number
}

export async function dre(
  tenantId: string,
  empresaId: string,
  competenciaMakro: string,
): Promise<Dre> {
  const comp = competenciaParaBase(competenciaMakro)
  const bal = await contabilService.getBalancete(tenantId, empresaId, comp)

  // DRE usa o MOVIMENTO da competência (débitos/créditos do período),
  // não o saldo acumulado — resultado do exercício/período.
  const receitasItens = ordenar(
    bal.itens.filter((i) => !i.isSintetica && i.tipo === 'receita' && i.creditos - i.debitos > 0),
  )
  const despesasItens = ordenar(
    bal.itens.filter((i) => !i.isSintetica && i.tipo === 'despesa' && i.debitos - i.creditos > 0),
  )

  const linhas: LinhaDre[] = []
  let totalReceitas = 0
  for (const it of receitasItens) {
    const v = arred(it.creditos - it.debitos)
    linhas.push({ descricao: `${it.codigo} — ${it.nome}`, valor: v, nivel: 'item' })
    totalReceitas += v
  }
  linhas.push({ descricao: 'Total de receitas', valor: arred(totalReceitas), nivel: 'grupo' })

  let totalDespesas = 0
  for (const it of despesasItens) {
    const v = arred(it.debitos - it.creditos)
    linhas.push({
      descricao: `(−) ${it.codigo} — ${it.nome}`,
      valor: v,
      nivel: 'item',
    })
    totalDespesas += v
  }
  linhas.push({ descricao: 'Total de despesas', valor: arred(totalDespesas), nivel: 'grupo' })

  const resultado = arred(totalReceitas - totalDespesas)
  linhas.push({
    descricao:
      resultado >= 0 ? '(=) Resultado positivo (lucro)' : '(=) Resultado negativo (prejuízo)',
    valor: resultado,
    nivel: 'total',
  })

  return { linhas, receitas: arred(totalReceitas), despesas: arred(totalDespesas), resultado }
}

// ---------------------------------------------------------------------------
// Fechamento da competência (contabil_fechamentos — mig 0164)
// ---------------------------------------------------------------------------

export interface FechamentoRegistro {
  id: string
  tenant_id: string
  empresa_id: string
  competencia: string // AAAA-MM
  status: 'rascunho' | 'fechado'
  receitas: number
  despesas: number
  resultado: number
  detalhes_json?: string
  expand?: { empresa_id?: { nome_fantasia?: string; razao_social?: string } }
}

function colecaoFechamentos() {
  return pb.collection('contabil_fechamentos')
}

/** Persiste (create/update) os totais do fechamento da empresa+competência. */
export async function salvarFechamento(params: {
  tenantId: string
  empresaId: string
  competencia: string // AAAA-MM
  status: 'rascunho' | 'fechado'
  usuarioId?: string
}): Promise<void> {
  const { tenantId, empresaId, competencia, status, usuarioId } = params
  const bal = await contabilService.getBalancete(
    tenantId,
    empresaId,
    competenciaParaBase(competencia),
  )
  const b = await balancoPatrimonial(tenantId, empresaId, competencia)
  const d = await dre(tenantId, empresaId, competencia)

  const payload = {
    tenant_id: tenantId,
    empresa_id: empresaId,
    competencia,
    status,
    receitas: d.receitas,
    despesas: d.despesas,
    resultado: d.resultado,
    detalhes_json: JSON.stringify({
      balancete: {
        totalDebitos: bal.totalDebitos,
        totalCreditos: bal.totalCreditos,
        diferenca: bal.diferenca,
      },
      balanco: {
        totalAtivo: b.totalAtivo,
        totalPassivo: b.totalPassivo,
        totalPatrimonioLiquido: b.totalPatrimonioLiquido,
        diferenca: b.diferenca,
      },
      dre: { receitas: d.receitas, despesas: d.despesas, resultado: d.resultado },
      fechado_em: new Date().toISOString(),
    }),
    usuario_id: usuarioId || undefined,
  }

  const existentes = await colecaoFechamentos().getFullList<FechamentoRegistro>({
    filter: `tenant_id = "${tenantId}" && empresa_id = "${empresaId}" && competencia = "${competencia}"`,
    limit: 1,
  })

  if (existentes.length > 0) {
    await colecaoFechamentos().update(existentes[0].id, payload)
  } else {
    await colecaoFechamentos().create(payload)
  }
}

/**
 * Fecha a competência formalmente via `fechamento_competencia` (mig 0143) —
 * é a trava que impede novos lançamentos retroativos no service base.
 */
export async function fecharCompetencia(params: {
  tenantId: string
  empresaId: string
  competencia: string // AAAA-MM
  usuarioId?: string
}): Promise<void> {
  const { tenantId, empresaId, competencia, usuarioId } = params
  // 1. Persiste os demonstrativos antes de travar
  await salvarFechamento({ ...params, status: 'fechado' })

  // 2. Registra a trava formal de fechamento
  const colecao = pb.collection('fechamento_competencia')
  const existentes = await colecao.getFullList({
    filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competenciaParaBase(competencia)}"`,
    limit: 1,
  })
  if (existentes.length > 0) {
    await colecao.update(existentes[0].id, {
      status: 'fechado',
      usuario_id: usuarioId || undefined,
    })
  } else {
    await colecao.create({
      tenant_id: tenantId,
      empresa: empresaId,
      competencia: competenciaParaBase(competencia),
      status: 'fechado',
      usuario_id: usuarioId || undefined,
    })
  }
}

export async function statusFechamento(
  tenantId: string,
  empresaId: string,
  competencia: string,
): Promise<string | null> {
  const regs = await pb
    .collection('fechamento_competencia')
    .getFullList<{ id: string; status: string }>({
      filter: `tenant_id = "${tenantId}" && empresa = "${empresaId}" && competencia = "${competenciaParaBase(competencia)}"`,
      limit: 1,
    })
  return regs.length > 0 ? regs[0].status : null
}

// ---------------------------------------------------------------------------
// utils
// ---------------------------------------------------------------------------

function arred(v: number) {
  return Math.round(v * 100) / 100
}

function ordenar(itens: BalanceteItem[]) {
  return [...itens].sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }))
}

/** Utilitário das fases para reusar o Balancete do service base. */
export const balanceteMakro = {
  get: contabilService.getBalancete,
  competenciaParaBase,
}

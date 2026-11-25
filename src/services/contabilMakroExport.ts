/**
 * Exportadores TXT/CSV dos demonstrativos contábeis (Fatia 4 Makro).
 * Mantido separado do service principal para manter os arquivos pequenos.
 */

import { formatCurrency } from '@/lib/formatters'
import type { ItemDiario, ItemRazao } from '@/services/contabilMakro'

export function baixarArquivo(nome: string, conteudo: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([conteudo], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

export function exportarDiarioTxt(
  itens: ItemDiario[],
  empresaNome: string,
  competencia: string,
): string {
  const sep = '='.repeat(100)
  const corpos = itens.map((it) =>
    [
      `Data: ${it.data.slice(0, 10)}   Lote: ${it.loteId}   Origem: ${it.origem}`,
      `Histórico: ${it.historico}`,
      `  D ${it.debitoCodigo.padEnd(12)} ${it.debitoNome}`,
      `  C ${it.creditoCodigo.padEnd(12)} ${it.creditoNome}`,
      `  Valor: ${formatCurrency(it.valor)}`,
      '-'.repeat(100),
    ].join('\n'),
  )
  return [
    sep,
    `LIVRO DIÁRIO — ${empresaNome} — Competência ${competencia}`,
    `${itens.length} lançamento(s) em partida dobrada`,
    sep,
    ...corpos,
  ].join('\n')
}

export function exportarRazaoTxt(
  itens: ItemRazao[],
  empresaNome: string,
  competencia: string,
): string {
  const sep = '='.repeat(100)
  const blocos = itens.map((conta) =>
    [
      `CONTA ${conta.codigo} — ${conta.nome}`,
      `Saldo anterior: ${formatCurrency(conta.saldoInicial)}`,
      ...conta.linhas.map(
        (l) =>
          `  ${l.data.slice(0, 10)}  ${l.tipo.toUpperCase().padEnd(8)} ${formatCurrency(l.valor).padEnd(18)} ${l.historico} (contra ${l.contrapartida})`,
      ),
      `Saldo final: ${formatCurrency(conta.saldoFinal)}`,
      '-'.repeat(100),
    ].join('\n'),
  )
  return [sep, `LIVRO RAZÃO — ${empresaNome} — Competência ${competencia}`, sep, ...blocos].join(
    '\n',
  )
}

export function exportarBalanceteCsv(
  itens: Array<{
    codigo: string
    nome: string
    saldoAnterior: number
    debitos: number
    creditos: number
    saldoAtual: number
  }>,
  empresaNome: string,
  competencia: string,
): string {
  const cab = 'Conta;Descrição;Saldo anterior;Débitos;Créditos;Saldo atual'
  const linhas = itens.map(
    (i) =>
      `${i.codigo};"${i.nome}";${i.saldoAnterior.toFixed(2)};${i.debitos.toFixed(2)};${i.creditos.toFixed(2)};${i.saldoAtual.toFixed(2)}`,
  )
  return [`Balancete de Verificação;${empresaNome};${competencia}`, cab, ...linhas].join('\n')
}

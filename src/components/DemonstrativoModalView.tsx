import React, { useRef } from 'react'
import {
  FileText,
  Printer,
  X,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Download,
} from 'lucide-react'
import type { DemonstrativoRecord, Empresa } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDatePtBr } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface DemonstrativoModalViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  demonstrativo: DemonstrativoRecord | null
  empresa?: Empresa | null
  // Ações de aprovação (no caso de exibição no Portal do Cliente)
  canApprove?: boolean
  onAprovar?: () => void
  onReprovar?: () => void
  approving?: boolean
}

export function DemonstrativoModalView({
  open,
  onOpenChange,
  demonstrativo,
  empresa,
  canApprove = false,
  onAprovar,
  onReprovar,
  approving = false,
}: DemonstrativoModalViewProps) {
  const printRef = useRef<HTMLDivElement>(null)

  if (!demonstrativo) return null

  const dados = demonstrativo.dados || {}
  const isDre = demonstrativo.tipo === 'dre'
  const isBalanco = demonstrativo.tipo === 'balanco'

  // Impressão via janela do navegador (window.print com CSS específico)
  const handlePrint = () => {
    window.print()
  }

  const getStatusBadge = () => {
    switch (demonstrativo.status) {
      case 'aprovado':
        return (
          <Badge className="bg-emerald-600 text-white font-bold text-xs">
            Aprovado pelo Cliente
          </Badge>
        )
      case 'enviado':
        return (
          <Badge className="bg-blue-600 text-white font-bold text-xs">Aguardando Aprovação</Badge>
        )
      case 'reprovado':
        return (
          <Badge className="bg-rose-600 text-white font-bold text-xs">
            Reprovado com Apontamento
          </Badge>
        )
      default:
        return <Badge className="bg-slate-500 text-white font-bold text-xs">Rascunho</Badge>
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl">
        <DialogHeader className="p-6 pb-3 border-b border-slate-100 flex flex-row items-center justify-between no-print">
          <div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg font-bold text-[#1A2333]">
                {isDre ? 'Demonstração do Resultado do Exercício (DRE)' : 'Balanço Patrimonial'}
              </DialogTitle>
              {getStatusBadge()}
            </div>
            <DialogDescription className="text-xs text-[#64748B] mt-0.5">
              Competência: {demonstrativo.competencia} •{' '}
              {empresa?.razao_social || empresa?.nome_fantasia || 'Empresa'}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 rounded-xl text-xs font-semibold h-9 border-[#E2E8F0] shadow-xs"
            >
              <Printer className="h-4 w-4 text-[#0FA3A3]" />
              <span>Imprimir / Salvar PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* ÁREA DE IMPRESSÃO / VISUALIZAÇÃO FORMAL */}
        <div ref={printRef} className="p-8 space-y-6 bg-white print:p-0 print:m-0 print:text-black">
          {/* Cabeçalho Formal */}
          <div className="border-b-2 border-[#123B6D] pb-4 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-[#0FA3A3] text-white flex items-center justify-center font-bold text-xs print:border print:border-black">
                  R
                </div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#123B6D]">
                  Rumo Consultoria Contábil
                </h3>
              </div>
              <p className="text-[11px] text-[#64748B]">
                CRC/SP nº 2SP034821/O • assessoria@rumoconsultoriacontabil.com.br
              </p>
              <p className="text-[10px] text-[#94A3B8]">
                Av. Paulista, 1578, Conjunto 802, Bela Vista - São Paulo / SP
              </p>
            </div>

            <div className="text-right space-y-0.5">
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-bold tracking-wider border-slate-300"
              >
                Documento Contábil Oficial
              </Badge>
              <p className="text-xs font-bold text-[#1A2333] mt-1">
                Competência: {demonstrativo.competencia}
              </p>
              <p className="text-[10px] text-[#64748B]">
                Emissão:{' '}
                {demonstrativo.created ? formatDatePtBr(demonstrativo.created) : 'Data Atual'}
              </p>
            </div>
          </div>

          {/* Dados da Empresa Cliente */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs text-[#1A2333] space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold uppercase tracking-wider text-[10px] text-[#64748B] block">
                  Empresa Contratante
                </span>
                <span className="font-extrabold text-sm text-[#1A2333]">
                  {empresa?.razao_social || empresa?.nome_fantasia || 'Empresa Cliente'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-mono font-semibold text-[#475569]">
                  CNPJ: {empresa?.cnpj || 'Não informado'}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-[#64748B] flex flex-wrap gap-x-4 gap-y-0.5 pt-1 border-t border-slate-200/60">
              <span>
                Regime:{' '}
                {empresa?.regime_tributario?.replace('_', ' ').toUpperCase() || 'Simples Nacional'}
              </span>
              <span>Porte: {empresa?.porte?.toUpperCase() || 'ME'}</span>
              <span>
                Localidade: {empresa?.cidade || 'São Paulo'} - {empresa?.uf || 'SP'}
              </span>
            </div>
          </div>

          {/* TABELAS DO DEMONSTRATIVO */}
          {isDre && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-1">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#123B6D]">
                  Demonstração do Resultado do Exercício — Padrão CPC / NBC TG
                </h4>
                <span className="text-[11px] text-[#64748B] font-mono">
                  Valores expressos em Reais (R$)
                </span>
              </div>

              <table className="w-full text-left text-xs border border-slate-200 divide-y divide-slate-200">
                <thead className="bg-slate-100/80 font-bold text-[10px] uppercase text-[#64748B]">
                  <tr>
                    <th className="py-2.5 px-4 w-24">Código</th>
                    <th className="py-2.5 px-4">Descrição da Conta / Linha</th>
                    <th className="py-2.5 px-4 text-right w-44">Valor Apurado (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {dados.linhas && dados.linhas.length > 0 ? (
                    dados.linhas.map((l) => {
                      const isResultado = l.tipo === 'resultado'
                      const isTotalizador = l.tipo === 'totalizador'
                      const isGrupo = l.tipo === 'grupo'
                      const isConta = l.tipo === 'conta'

                      return (
                        <tr
                          key={l.id}
                          className={cn(
                            isResultado
                              ? 'bg-emerald-50/70 font-extrabold text-sm text-emerald-950 print:bg-slate-200'
                              : isTotalizador
                                ? 'bg-slate-100 font-bold text-[#1A2333]'
                                : isGrupo
                                  ? 'bg-slate-50 font-bold text-[#1A2333]'
                                  : 'text-[#475569]',
                          )}
                        >
                          <td
                            className={cn(
                              'py-2 px-4 font-mono',
                              isConta ? 'pl-8 text-[11px]' : 'font-bold',
                            )}
                          >
                            {l.codigo}
                          </td>
                          <td className={cn('py-2 px-4', isConta && 'pl-8 text-[11px]')}>
                            {l.descricao}
                          </td>
                          <td
                            className={cn(
                              'py-2 px-4 text-right font-mono',
                              l.negativo ? 'text-rose-600 font-semibold' : 'text-[#1A2333]',
                              isResultado && 'font-bold text-sm text-emerald-700',
                            )}
                          >
                            {l.negativo
                              ? `(${l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
                              : l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-[#94A3B8]">
                        Nenhuma linha de demonstração encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Totalizador em Destaque */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-[#1A2333]">
                  Resultado Líquido Apurado no Período:
                </span>
                <span
                  className={cn(
                    'font-mono font-extrabold text-base',
                    (dados.resultadoLiquido ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600',
                  )}
                >
                  R${' '}
                  {(dados.resultadoLiquido ?? 0).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          )}

          {isBalanco && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-1">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#123B6D]">
                  Balanço Patrimonial Estruturado — Padrão CPC / CFC
                </h4>
                <span className="text-[11px] text-[#64748B] font-mono">Valores em Reais (R$)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ativo */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 p-2.5 font-bold text-xs text-[#123B6D] flex justify-between">
                    <span>1. ATIVO TOTAL</span>
                    <span>
                      R${' '}
                      {(dados.ativoTotal ?? 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="p-3 space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between font-semibold text-[11px] text-[#1A2333] border-b pb-1">
                        <span>1.1 Ativo Circulante</span>
                        <span>
                          R${' '}
                          {(dados.ativoCirculante?.saldo ?? 0).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="mt-1 space-y-1 pl-2">
                        {dados.ativoCirculante?.contas?.map((c) => (
                          <div
                            key={c.codigo}
                            className="flex justify-between text-[10px] text-[#64748B]"
                          >
                            <span>
                              {c.codigo} {c.nome}
                            </span>
                            <span className="font-mono">
                              R$ {c.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-semibold text-[11px] text-[#1A2333] border-b pb-1">
                        <span>1.2 Ativo Não Circulante (Imobilizado)</span>
                        <span>
                          R${' '}
                          {(dados.ativoNaoCirculante?.saldo ?? 0).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="mt-1 space-y-1 pl-2">
                        {dados.ativoNaoCirculante?.contas?.map((c) => (
                          <div
                            key={c.codigo}
                            className="flex justify-between text-[10px] text-[#64748B]"
                          >
                            <span>
                              {c.codigo} {c.nome}
                            </span>
                            <span className="font-mono">
                              R$ {c.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Passivo + PL */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 p-2.5 font-bold text-xs text-purple-900 flex justify-between">
                    <span>2. PASSIVO E PATRIMÔNIO LÍQUIDO</span>
                    <span>
                      R${' '}
                      {(dados.passivoMaisPL ?? 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="p-3 space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between font-semibold text-[11px] text-[#1A2333] border-b pb-1">
                        <span>2.1 Passivo Circulante</span>
                        <span>
                          R${' '}
                          {(dados.passivoCirculante?.saldo ?? 0).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="mt-1 space-y-1 pl-2">
                        {dados.passivoCirculante?.contas?.map((c) => (
                          <div
                            key={c.codigo}
                            className="flex justify-between text-[10px] text-[#64748B]"
                          >
                            <span>
                              {c.codigo} {c.nome}
                            </span>
                            <span className="font-mono">
                              R$ {c.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-semibold text-[11px] text-[#1A2333] border-b pb-1">
                        <span>2.2 Patrimônio Líquido</span>
                        <span>
                          R${' '}
                          {(dados.patrimonioLiquido?.saldo ?? 0).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="mt-1 space-y-1 pl-2">
                        {dados.patrimonioLiquido?.contas?.map((c) => (
                          <div
                            key={c.codigo}
                            className="flex justify-between text-[10px] text-[#64748B]"
                          >
                            <span>
                              {c.codigo} {c.nome}
                            </span>
                            <span className="font-mono">
                              R$ {c.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Equilíbrio */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-[#1A2333]">
                  Equação Fundamental da Contabilidade:
                </span>
                <span className="font-mono font-semibold text-emerald-700">
                  Total Ativo: R${' '}
                  {(dados.ativoTotal ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} =
                  Passivo + PL: R${' '}
                  {(dados.passivoMaisPL ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* Termo de Aprovação e Assinaturas Formais */}
          <div className="pt-6 border-t border-slate-300 mt-8 space-y-6">
            <p className="text-[11px] text-slate-500 text-justify leading-relaxed">
              Declaramos que o presente demonstrativo contábil reflete fidedignamente a escrituração
              mercantil da empresa e os fatos contábeis ocorridos na competência supra, de acordo
              com as Normas Brasileiras de Contabilidade (NBC) e a legislação vigente.
            </p>

            {demonstrativo.status === 'aprovado' && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between">
                <div>
                  <p className="font-bold">✓ Assinado e Aprovado Digitalmente pelo Cliente</p>
                  <p className="text-[11px] text-emerald-800">
                    Aprovado em:{' '}
                    {demonstrativo.data_aprovacao
                      ? formatDatePtBr(demonstrativo.data_aprovacao)
                      : 'Data gravada'}
                  </p>
                </div>
                <Badge className="bg-emerald-600 text-white font-bold">
                  Válido para Órgãos Fiscais
                </Badge>
              </div>
            )}

            {demonstrativo.status === 'reprovado' && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs">
                <p className="font-bold">✕ Demonstrativo Reprovado pelo Cliente</p>
                <p className="text-[11px] text-rose-800 mt-1 font-mono">
                  Motivo: {demonstrativo.observacoes_cliente || 'Nenhum detalhe fornecido'}
                </p>
              </div>
            )}

            {/* Linhas de Assinatura */}
            <div className="grid grid-cols-2 gap-8 pt-10 text-center text-xs">
              <div className="space-y-1">
                <div className="border-t border-slate-800 w-3/4 mx-auto" />
                <p className="font-bold text-[#1A2333]">
                  {empresa?.razao_social ||
                    empresa?.nome_fantasia ||
                    'Representante Legal da Empresa'}
                </p>
                <p className="text-[10px] text-[#64748B]">
                  Assinatura do Responsável Legal / Titular
                </p>
              </div>

              <div className="space-y-1">
                <div className="border-t border-slate-800 w-3/4 mx-auto" />
                <p className="font-bold text-[#1A2333]">Contador Responsável Técnico</p>
                <p className="text-[10px] text-[#64748B]">
                  CRC/SP 2SP034821/O • Rumo Consultoria Contábil
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal (ações de aprovação para o cliente no Portal) */}
        <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between no-print">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs text-[#64748B]"
          >
            Fechar
          </Button>

          {canApprove && demonstrativo.status === 'enviado' && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onReprovar}
                disabled={approving}
                className="rounded-xl text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                Reprovar com Apontamento
              </Button>
              <Button
                type="button"
                onClick={onAprovar}
                disabled={approving}
                className="rounded-xl text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white shadow-xs"
              >
                {approving ? 'Gravando Aprovação...' : 'Aprovar e Assinar Demonstrativo'}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

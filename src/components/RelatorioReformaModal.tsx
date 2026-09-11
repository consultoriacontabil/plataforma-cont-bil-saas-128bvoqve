import React, { useRef } from 'react'
import {
  Printer,
  Calendar,
  Building2,
  FileText,
  AlertTriangle,
  Lightbulb,
  Info,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { SimulacaoCalculada } from '@/lib/reformaTributaria/calculos'
import { SETORES_CONFIG } from '@/lib/reformaTributaria/parametros'

interface RelatorioReformaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  calculada: SimulacaoCalculada | null
  tituloRelatorio?: string
}

export function RelatorioReformaModal({
  open,
  onOpenChange,
  calculada,
  tituloRelatorio,
}: RelatorioReformaModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  if (!calculada) return null

  const { inputs, tabelaAnual, resumo, parametrosUtilizados } = calculada
  const setorConfig = SETORES_CONFIG[inputs.setorAtividade]

  const handlePrint = () => {
    window.print()
  }

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl">
        <DialogHeader className="p-6 pb-3 border-b border-slate-100 flex flex-row items-center justify-between no-print">
          <div>
            <DialogTitle className="text-lg font-bold text-[#1A2333]">
              Relatório de Análise da Reforma Tributária (IBS/CBS)
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B] mt-0.5">
              Planejamento de Transição 2026–2033 • Emissão para Cliente
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

        {/* ÁREA FORMAL DE IMPRESSÃO */}
        <div ref={printRef} className="p-8 space-y-6 bg-white print:p-0 print:m-0 print:text-black">
          {/* Cabeçalho do Escritório */}
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
                Parecer Técnico Contábil
              </Badge>
              <p className="text-xs font-bold text-[#1A2333] mt-1">
                Ref: EC 132/2023 & LC 214/2025
              </p>
              <p className="text-[10px] text-[#64748B]">
                Data de Emissão: {new Date().toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>

          {/* Dados da Empresa e Premissas do Cenário */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <span className="font-bold uppercase tracking-wider text-[10px] text-[#64748B] block">
                  Empresa Analisada
                </span>
                <span className="font-extrabold text-sm text-[#1A2333]">
                  {inputs.razaoSocial || 'Análise Avulsa / Planejamento Tributário'}
                </span>
                {tituloRelatorio && (
                  <p className="text-xs text-[#0FA3A3] font-medium">{tituloRelatorio}</p>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-[#1A2333] block">
                  Regime Atual: {inputs.regimeAtual.replace('_', ' ').toUpperCase()}
                </span>
                <span className="text-[11px] text-[#64748B]">
                  Faturamento Anual: {formatBRL(inputs.faturamentoAnual)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
              <div>
                <span className="text-[#64748B] block">Setor de Atividade:</span>
                <span className="font-semibold text-[#1A2333]">
                  {setorConfig?.nome || inputs.setorAtividade}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Alíquota Efetiva Atual:</span>
                <span className="font-semibold text-[#1A2333]">
                  {inputs.aliquotaAtualEstimada}%
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Créditos de Insumos:</span>
                <span className="font-semibold text-[#1A2333]">
                  {inputs.percentualCreditosInsumos}% da receita
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Tratamento Diferenciado:</span>
                <span className="font-semibold text-[#1A2333]">
                  {inputs.reducaoSetorial60
                    ? 'Redução de 60%'
                    : inputs.vendeCestaBasica
                      ? 'Cesta Básica (Aliq. Zero)'
                      : 'Regime Padrão'}
                </span>
              </div>
            </div>
          </div>

          {/* Cards Resumo de Impacto */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-[10px] uppercase font-bold text-[#64748B]">
                Carga Tributária Atual
              </span>
              <p className="text-base font-extrabold text-[#1A2333] mt-0.5">
                {formatBRL((inputs.faturamentoAnual * inputs.aliquotaAtualEstimada) / 100)} / ano
              </p>
              <span className="text-[10px] text-[#64748B]">Ano Base {inputs.anoBase}</span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-[10px] uppercase font-bold text-[#64748B]">
                Impacto Acumulado (2026-2033)
              </span>
              <p
                className={`text-base font-extrabold mt-0.5 ${resumo.impactoTotalAcumuladoReais > 0 ? 'text-amber-600' : 'text-emerald-600'}`}
              >
                {resumo.impactoTotalAcumuladoReais > 0 ? '+' : ''}
                {formatBRL(resumo.impactoTotalAcumuladoReais)}
              </p>
              <span className="text-[10px] text-[#64748B]">
                Variação média: {resumo.mediaVariacaoPercentual > 0 ? '+' : ''}
                {resumo.mediaVariacaoPercentual.toFixed(1)}%
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-[10px] uppercase font-bold text-[#64748B]">
                Ponto de Atenção / Virada
              </span>
              <p className="text-xs font-bold text-[#1A2333] mt-1 line-clamp-2">
                {resumo.anoVirada ? `A partir de ${resumo.anoVirada}` : 'Transição Progressiva'}
              </p>
              <span className="text-[10px] text-[#64748B]">
                Pico: {resumo.maiorAumentoReais.ano} (+{formatBRL(resumo.maiorAumentoReais.valor)})
              </span>
            </div>
          </div>

          {/* TABELA COMPLETA DA TRANSIÇÃO (2026 a 2033) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-1">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#123B6D] flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#0FA3A3]" />
                Cronograma de Transição Tributária (2026 a 2033)
              </h4>
              <span className="text-[10px] text-[#64748B]">Valores em Reais (R$)</span>
            </div>

            <table className="w-full text-left text-xs border border-slate-200 divide-y divide-slate-200">
              <thead className="bg-slate-100/90 font-bold text-[10px] uppercase text-[#64748B]">
                <tr>
                  <th className="py-2.5 px-3">Ano</th>
                  <th className="py-2.5 px-3">Fase & Descrição Legal</th>
                  <th className="py-2.5 px-3 text-right">Carga Atual (R$)</th>
                  <th className="py-2.5 px-3 text-right">Alíq. IBS/CBS</th>
                  <th className="py-2.5 px-3 text-right">Carga Projetada (R$)</th>
                  <th className="py-2.5 px-3 text-right">Diferença (R$)</th>
                  <th className="py-2.5 px-3 text-right">Variação %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {tabelaAnual.map((item) => (
                  <tr
                    key={item.ano}
                    className={item.ano === 2033 ? 'bg-slate-50 font-semibold' : ''}
                  >
                    <td className="py-2 px-3 font-bold font-mono">{item.ano}</td>
                    <td className="py-2 px-3 text-[11px] text-[#475569]">{item.descricao}</td>
                    <td className="py-2 px-3 text-right font-mono">
                      {formatBRL(item.cargaAtualEstimadaReais)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {item.aliquotaNominalCombinada}%
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-[#1A2333]">
                      {formatBRL(item.cargaProjetadaIBSCBSReais)}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-mono font-semibold ${item.diferencaReais > 0 ? 'text-amber-700' : item.diferencaReais < 0 ? 'text-emerald-700' : 'text-slate-600'}`}
                    >
                      {item.diferencaReais > 0 ? '+' : ''}
                      {formatBRL(item.diferencaReais)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${item.diferencaPercentual > 0 ? 'bg-amber-100 text-amber-800' : item.diferencaPercentual < 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}
                      >
                        {item.diferencaPercentual > 0 ? '+' : ''}
                        {item.diferencaPercentual}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PARECER TÉCNICO E RECOMENDAÇÕES */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#123B6D] flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-[#0FA3A3]" />
              Parecer Técnico & Recomendações Estratégicas
            </h4>

            <div className="space-y-2 text-xs text-[#334155]">
              {resumo.recomendacoes.map((rec, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80"
                >
                  <span className="font-bold text-[#0FA3A3] shrink-0">{idx + 1}.</span>
                  <p className="leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>

            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-950">
              <Info className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Fundamentação Legal:</span>
                <p className="mt-0.5 text-[11px] text-blue-900 leading-normal">
                  Cálculos elaborados com base na Emenda Constitucional nº 132/2023, Lei
                  Complementar nº 214/2025, com alíquota de referência padrão de{' '}
                  {parametrosUtilizados.aliquotaReferenciaPlena.total}% (CBS{' '}
                  {parametrosUtilizados.aliquotaReferenciaPlena.cbs}% + IBS{' '}
                  {parametrosUtilizados.aliquotaReferenciaPlena.ibs}%) e escalonamento dos arts. 125
                  a 133 do ADCT.
                </p>
              </div>
            </div>
          </div>

          {/* Assinatura do Contador / Responsável Técnico */}
          <div className="pt-8 border-t border-slate-300 flex justify-between items-end text-xs">
            <div>
              <p className="text-[10px] text-[#94A3B8]">
                Elaborado por Plataforma Contábil Rumo Contábil
              </p>
              <p className="text-[10px] text-[#94A3B8]">Módulo Fiscal & Consultoria Tributária</p>
            </div>
            <div className="text-center w-64 border-t border-slate-400 pt-1">
              <p className="font-bold text-[#1A2333]">Rumo Consultoria Contábil</p>
              <p className="text-[11px] text-[#64748B]">Departamento de Inteligência Tributária</p>
              <p className="text-[10px] text-[#94A3B8]">CRC/SP 2SP034821/O</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

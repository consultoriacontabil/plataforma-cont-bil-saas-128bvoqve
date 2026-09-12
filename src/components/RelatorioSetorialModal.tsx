import React, { useRef } from 'react'
import {
  Printer,
  Calendar,
  Building2,
  FileText,
  AlertTriangle,
  Lightbulb,
  Info,
  CheckCircle2,
  TrendingUp,
  Percent,
  ShieldCheck,
  Award,
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
import type { RelatorioSetorialCarteira } from '@/services/relatorioSetorial'
import { PARAMETROS_REFORMA } from '@/lib/reformaTributaria/parametros'

interface RelatorioSetorialModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  relatorio: RelatorioSetorialCarteira | null
  tenantNome?: string
}

export function RelatorioSetorialModal({
  open,
  onOpenChange,
  relatorio,
  tenantNome,
}: RelatorioSetorialModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  if (!relatorio) return null

  const handlePrint = () => {
    window.print()
  }

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const emissaoData = new Date(relatorio.geradoEm).toLocaleDateString('pt-BR')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl">
        <DialogHeader className="p-6 pb-3 border-b border-slate-100 flex flex-row items-center justify-between no-print">
          <div>
            <DialogTitle className="text-lg font-bold text-[#1A2333]">
              Relatório Setorial de Impacto da Reforma Tributária
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B] mt-0.5">
              Diagnóstico Estratégico da Carteira de Clientes • Visão Executiva & Parecer Técnico
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
                <div className="h-8 w-8 rounded-lg bg-[#0FA3A3] text-white flex items-center justify-center font-bold text-sm print:border print:border-black">
                  R
                </div>
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#123B6D]">
                    {tenantNome || 'Rumo Consultoria Contábil'}
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    CRC/SP nº 2SP034821/O • Departamento de Inteligência e Planejamento Tributário
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-[#94A3B8]">
                Av. Paulista, 1578, Conjunto 802, Bela Vista - São Paulo / SP •
                assessoria@rumoconsultoriacontabil.com.br
              </p>
            </div>

            <div className="text-right space-y-0.5">
              <Badge
                variant="outline"
                className="text-[10px] uppercase font-bold tracking-wider border-slate-300"
              >
                Parecer Técnico Executivo
              </Badge>
              <p className="text-xs font-bold text-[#1A2333] mt-1">
                Ref: EC 132/2023 & LC 214/2025
              </p>
              <p className="text-[10px] text-[#64748B]">Data de Emissão: {emissaoData}</p>
            </div>
          </div>

          {/* Título & Resumo Geral do Parecer */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <span className="font-bold uppercase tracking-wider text-[10px] text-[#64748B] block">
                  Objeto da Avaliação Contábil
                </span>
                <span className="font-extrabold text-sm text-[#1A2333]">
                  Ranking de Impacto Tributário por Setor da Carteira de Clientes
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-[#1A2333] block">
                  {relatorio.totalEmpresasAnalisadas} Empresas Analisadas
                </span>
                <span className="text-[11px] text-[#64748B]">
                  Período de Transição: 2026 a 2033
                </span>
              </div>
            </div>

            <p className="text-xs text-[#334155] leading-relaxed">
              Este relatório apresenta a estratificação setorial de impacto decorrente da
              substituição do PIS, COFINS, ICMS e ISS pelo modelo do Imposto sobre Bens e Serviços
              (IBS) e Contribuição sobre Bens e Serviços (CBS), permitindo ao escritório contábil
              orientar preventivamente seus clientes acerca de renegociação de preços, créditos
              sobre insumos e planejamento de regimes (Simples, Lucro Presumido e Lucro Real).
            </p>
          </div>

          {/* Cards Executivos de Síntese */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-[10px] uppercase font-bold text-[#64748B]">
                Faturamento Total Base
              </span>
              <p className="text-sm font-extrabold text-[#1A2333] mt-0.5">
                {formatBRL(relatorio.faturamentoTotalCarteira)}
              </p>
              <span className="text-[10px] text-[#64748B]">
                {relatorio.totalEmpresasSuficientes} empresas com dados
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-[10px] uppercase font-bold text-[#64748B]">
                Carga Tributária Atual
              </span>
              <p className="text-sm font-extrabold text-[#1A2333] mt-0.5">
                {formatBRL(relatorio.cargaAtualTotalCarteira)} / ano
              </p>
              <span className="text-[10px] text-[#64748B]">PIS, COFINS, ICMS, ISS e DAS</span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-[10px] uppercase font-bold text-[#64748B]">
                Carga Plena em 2033
              </span>
              <p className="text-sm font-extrabold text-[#1A2333] mt-0.5">
                {formatBRL(relatorio.carga2033TotalCarteira)} / ano
              </p>
              <span className="text-[10px] text-[#64748B]">
                Variação: {relatorio.variacaoGeralCarteiraPercentual > 0 ? '+' : ''}
                {relatorio.variacaoGeralCarteiraPercentual}%
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-[10px] uppercase font-bold text-[#64748B]">
                Impacto Acumulado Carteira
              </span>
              <p
                className={`text-sm font-extrabold mt-0.5 ${
                  relatorio.impactoTotalCarteiraAcumuladoReais > 0
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {relatorio.impactoTotalCarteiraAcumuladoReais > 0 ? '+' : ''}
                {formatBRL(relatorio.impactoTotalCarteiraAcumuladoReais)}
              </p>
              <span className="text-[10px] text-[#64748B]">2026–2033 somado</span>
            </div>
          </div>

          {/* TABELA 1: SÍNTESE POR SETOR DA CARTEIRA */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#123B6D] flex items-center gap-1.5 border-b pb-1">
              <Building2 className="h-3.5 w-3.5 text-[#0FA3A3]" />
              1. Agrupamento por Setor de Atividade Econômica
            </h4>

            <table className="w-full text-left text-xs border border-slate-200 divide-y divide-slate-200">
              <thead className="bg-slate-100 font-bold text-[10px] uppercase text-[#64748B]">
                <tr>
                  <th className="py-2.5 px-3">Setor Econômico</th>
                  <th className="py-2.5 px-3 text-center">Tratamento Legal</th>
                  <th className="py-2.5 px-3 text-center">Empresas</th>
                  <th className="py-2.5 px-3 text-right">Faturamento Total</th>
                  <th className="py-2.5 px-3 text-right">Carga Atual</th>
                  <th className="py-2.5 px-3 text-right">Carga 2033</th>
                  <th className="py-2.5 px-3 text-right">Variação %</th>
                  <th className="py-2.5 px-3 text-right">Impacto Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-[11px]">
                {relatorio.setoresResumo.map((s) => (
                  <tr key={s.setorId} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 font-semibold text-[#1A2333]">{s.setorNome}</td>
                    <td className="py-2 px-3 text-center">
                      {s.reducao60 ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                          Redução 60%
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[9px] font-medium">
                          Padrão (~26,5%)
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-mono">{s.quantidadeEmpresas}</td>
                    <td className="py-2 px-3 text-right font-mono text-[#64748B]">
                      {formatBRL(s.faturamentoTotal)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[#64748B]">
                      {formatBRL(s.cargaAtualTotal)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-[#1A2333]">
                      {formatBRL(s.carga2033Total)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      <span
                        className={`font-semibold ${
                          s.variacaoMediaPercentual > 0 ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {s.variacaoMediaPercentual > 0 ? '+' : ''}
                        {s.variacaoMediaPercentual}%
                      </span>
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-mono font-bold ${
                        s.impactoAcumuladoTotal > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {s.impactoAcumuladoTotal > 0 ? '+' : ''}
                      {formatBRL(s.impactoAcumuladoTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* TABELA 2: RANKING DETALHADO POR EMPRESA */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#123B6D] flex items-center gap-1.5 border-b pb-1">
              <FileText className="h-3.5 w-3.5 text-[#0FA3A3]" />
              2. Ranking Completo de Empresas (Maior ao Menor Impacto)
            </h4>

            <table className="w-full text-left text-xs border border-slate-200 divide-y divide-slate-200">
              <thead className="bg-slate-100 font-bold text-[10px] uppercase text-[#64748B]">
                <tr>
                  <th className="py-2.5 px-3">Empresa / CNPJ</th>
                  <th className="py-2.5 px-3">Setor / CNAE</th>
                  <th className="py-2.5 px-3 text-center">Regime</th>
                  <th className="py-2.5 px-3 text-right">Faturamento Base</th>
                  <th className="py-2.5 px-3 text-right">Carga Atual</th>
                  <th className="py-2.5 px-3 text-right">Carga 2033</th>
                  <th className="py-2.5 px-3 text-right">Impacto Acum.</th>
                  <th className="py-2.5 px-3 text-right">Variação %</th>
                  <th className="py-2.5 px-3 text-center">Tratamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-[11px]">
                {relatorio.rankingEmpresas.map((item, idx) => (
                  <tr
                    key={item.empresaId}
                    className={`hover:bg-slate-50/50 ${!item.dadosSuficientes ? 'bg-amber-50/30 text-slate-500' : ''}`}
                  >
                    <td className="py-2 px-3">
                      <div className="font-bold text-[#1A2333] flex items-center gap-1.5">
                        <span className="text-[10px] text-[#94A3B8] font-mono">#{idx + 1}</span>
                        <span>{item.razaoSocial}</span>
                      </div>
                      <span className="text-[10px] text-[#64748B] font-mono">{item.cnpj}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-medium text-[#1A2333] block">{item.setorNome}</span>
                      {item.cnaeDetectado && (
                        <span className="text-[10px] text-[#64748B] block truncate max-w-[160px]">
                          {item.cnaeDetectado}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] uppercase font-mono">
                        {item.regime.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {item.dadosSuficientes ? (
                        <>
                          <span className="text-[#1A2333]">{formatBRL(item.faturamentoBase)}</span>
                          <span className="block text-[9px] text-[#94A3B8]">
                            {item.origemFaturamento === 'contabil_real'
                              ? 'Lançamentos'
                              : item.origemFaturamento === 'simulacao_salva'
                                ? 'Simulação'
                                : 'Estimado'}
                          </span>
                        </>
                      ) : (
                        <span className="text-amber-700 font-semibold text-[10px]">
                          Dados insuficientes
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-[#64748B]">
                      {item.dadosSuficientes ? formatBRL(item.cargaAtualReais) : '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-[#1A2333]">
                      {item.dadosSuficientes ? formatBRL(item.carga2033Reais) : '-'}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-mono font-bold ${
                        !item.dadosSuficientes
                          ? 'text-slate-400'
                          : item.impactoAcumuladoReais > 0
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                      }`}
                    >
                      {item.dadosSuficientes ? (
                        <>
                          {item.impactoAcumuladoReais > 0 ? '+' : ''}
                          {formatBRL(item.impactoAcumuladoReais)}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      {item.dadosSuficientes ? (
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.variacao2033Percentual > 0
                              ? 'bg-amber-100 text-amber-800'
                              : item.variacao2033Percentual < 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.variacao2033Percentual > 0 ? '+' : ''}
                          {item.variacao2033Percentual}%
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-700 font-medium">
                          Requer faturamento
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="text-[10px] font-semibold text-[#1A2333]">
                        {item.tratamentoBadge}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PARECER TÉCNICO CONTÁBIL & DIRETRIZES ESTRATÉGICAS */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#123B6D] flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-[#0FA3A3]" />
              3. Parecer Técnico do Escritório & Conclusões Estratégicas
            </h4>

            <div className="space-y-2 text-xs text-[#334155] leading-relaxed">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-[#1A2333] block">
                  a) Impacto Concentrado em Serviços Puros & Tecnologia:
                </span>
                <p>
                  As empresas de consultoria, assessoria e desenvolvimento de software não possuem
                  apropriação expressiva de insumos físicos (folha de pagamento não gera créditos de
                  IBS/CBS). Para clientes nestes setores enquadrados no Lucro Presumido, a carga
                  tributária nominal sofrerá expressiva elevação a partir de 2027 (CBS 8,8%) e 2033
                  (26,5%). Recomenda-se revisar contratos de prestação com cláusula de repasse do
                  split payment tributário.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-[#1A2333] block">
                  b) Preservação de Margem em Saúde Humana e Educação (Redução de 60%):
                </span>
                <p>
                  As clínicas médicas e entidades educacionais da carteira foram devidamente
                  enquadradas no regime favorecido do art. 9º da EC 132/2023 e LC 214/2025. A
                  alíquota efetiva combinada projetada é de ~10,6%, mantendo estabilidade frente à
                  carga atual do Lucro Presumido e Simples Nacional.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-bold text-[#1A2333] block">
                  c) Clientes no Simples Nacional e Repasse de Créditos PJ:
                </span>
                <p>
                  Empresas no Simples com receita anual até R$ 3,6 milhões dispõem da redução de 50%
                  do IBS/CBS até 2032. Todavia, para clientes que vendem primariamente a pessoas
                  jurídicas (B2B), a limitação de crédito aos tomadores pode gerar perda de
                  competitividade, exigindo simulação de adesão ao regime regular de IVA.
                </p>
              </div>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-950">
              <Info className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Embasamento Normativo e Considerações Finais:</span>
                <p className="mt-0.5 text-[11px] text-blue-900 leading-normal">
                  Parecer fundamentado na Emenda Constitucional nº 132/2023, Lei Complementar nº
                  214/2025 e normas do ADCT. As projeções financeiras consideram os dados contábeis
                  apurados até a presente data e alíquotas de referência vigentes.
                </p>
              </div>
            </div>
          </div>

          {/* RESSALVA DE TRANSPARÊNCIA E CONFORMIDADE CFC */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-950">
            <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Ressalva Metodológica Regulatória (CFC):</span>
              <p className="mt-0.5 text-[11px] text-amber-900 leading-normal">
                Este diagnóstico setorial é uma{' '}
                <b>estimativa preliminar baseada em modelos da EC 132/2023 e LC 214/2025</b> sobre
                dados fiscais declarados e médias setoriais. Os valores reais dependerão das
                definições definitivas de alíquotas pelo Comitê Gestor do IBS e regulamentação
                complementar.
              </p>
            </div>
          </div>

          {/* Campo de Assinatura do Contador / Responsável Técnico */}
          <div className="pt-8 border-t border-slate-300 flex justify-between items-end text-xs">
            <div>
              <p className="text-[10px] text-[#94A3B8]">
                Plataforma Contábil Rumo Contábil • Auditoria & Inteligência Fiscal
              </p>
              <p className="text-[10px] text-[#94A3B8]">
                Documento gerado eletronicamente sob controle de auditoria
              </p>
            </div>
            <div className="text-center w-72 border-t border-slate-400 pt-1.5 space-y-0.5">
              <p className="font-bold text-[#1A2333]">
                {tenantNome || 'Rumo Consultoria Contábil'}
              </p>
              <p className="text-[11px] text-[#64748B]">Responsável Técnico Contábil</p>
              <p className="text-[10px] text-[#94A3B8]">CRC/SP 2SP034821/O</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

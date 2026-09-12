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
  Clock,
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
import type { EmpresaImpactoSetorial } from '@/services/relatorioSetorial'
import { PARAMETROS_REFORMA, SETORES_CONFIG } from '@/lib/reformaTributaria/parametros'
import { calcularSimulacaoReforma, SimulacaoInput } from '@/lib/reformaTributaria/calculos'

interface ApresentacaoExecutivaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresa: EmpresaImpactoSetorial | null
  tenantNome?: string
  crcEscritorio?: string
}

export function ApresentacaoExecutivaModal({
  open,
  onOpenChange,
  empresa,
  tenantNome = 'Rumo Consultoria Contábil',
  crcEscritorio = 'CRC/SP nº 2SP034821/O',
}: ApresentacaoExecutivaModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  if (!empresa) return null

  // Se a empresa já tem o cálculo acoplado, usa-o. Caso contrário, recalcula sob demanda.
  const calculada =
    empresa.calculada ||
    (empresa.faturamentoBase > 0
      ? calcularSimulacaoReforma({
          empresaId: empresa.empresaId,
          razaoSocial: empresa.razaoSocial,
          regimeAtual: empresa.regime,
          faturamentoAnual: empresa.faturamentoBase,
          percentualCreditosInsumos: empresa.percentualCreditos,
          setorAtividade: empresa.setor,
          reducaoSetorial60: empresa.tratamentoFavorecido,
          vendeCestaBasica: false,
          percentualCestaBasica: 0,
          aliquotaAtualEstimada: empresa.aliquotaAtualEfetiva,
          permanecerNoSimplesNaTransicao: true,
          anoBase: 2026,
        })
      : null)

  const handlePrint = () => {
    window.print()
  }

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const cronogramaDatasCriticas = [
    {
      data: '2026 (Ano de Teste)',
      fato: 'Início da vigência teste da CBS (0,9%) e IBS (0,1%) com compensação integral de PIS/COFINS.',
      impacto:
        'Adaptação tecnológica de sistemas ERP, emissão de NF-e/NFS-e com novas tags de IVA.',
    },
    {
      data: '2027 (Entrada Plena da CBS)',
      fato: 'Extinção definitiva de PIS e COFINS; início da cobrança plena da CBS federal (~8,8%).',
      impacto:
        'Fim da cumulatividade nos serviços de Lucro Presumido; reavaliação de margens e contratos.',
    },
    {
      data: '2029 a 2032 (Graduação do IBS)',
      fato: 'Redução progressiva de 10% ao ano de ICMS e ISS, com aumento proporcional do IBS dos estados e municípios.',
      impacto: 'Fase de dupla apuração fiscal; desoneração de investimentos e créditos de insumos.',
    },
    {
      data: '2033 (Regime Pleno Definitivo)',
      fato: 'Extinção total do ICMS e ISS. Vigência plena do IBS (~17,7%) e CBS (~8,8%).',
      impacto:
        'Encerramento dos regimes transitórios do Simples Nacional; apuração uniforme e não-cumulativa.',
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[94vh] overflow-y-auto p-0 rounded-2xl">
        <DialogHeader className="p-6 pb-3 border-b border-slate-100 flex flex-row items-center justify-between no-print">
          <div>
            <DialogTitle className="text-lg font-bold text-[#1A2333]">
              Apresentação Executiva ao Cliente
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B] mt-0.5">
              Dossiê Estratégico da Reforma Tributária (IBS/CBS) • Pronto para Reunião
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

        {/* LAYOUT FORMAL DE IMPRESSÃO (A4 READY) */}
        <div
          ref={printRef}
          className="p-8 space-y-6 bg-white print:p-0 print:m-0 print:text-black font-sans"
        >
          {/* CABEÇALHO DO ESCRITÓRIO */}
          <div className="border-b-2 border-[#123B6D] pb-4 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#0FA3A3] text-white flex items-center justify-center font-bold text-sm print:border print:border-black">
                  R
                </div>
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#123B6D]">
                    {tenantNome}
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    {crcEscritorio} • Departamento de Inteligência & Consultoria Tributária
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
                className="text-[10px] uppercase font-bold tracking-wider border-[#123B6D] text-[#123B6D]"
              >
                Apresentação Executiva
              </Badge>
              <p className="text-xs font-bold text-[#1A2333] mt-1">
                Ref: EC 132/2023 & LC 214/2025
              </p>
              <p className="text-[10px] text-[#64748B]">Emissão: {dataAtual}</p>
            </div>
          </div>

          {/* DADOS DO CLIENTE & BASE DA AVALIAÇÃO */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <span className="font-bold uppercase tracking-wider text-[10px] text-[#64748B] block">
                  Cliente / Razão Social
                </span>
                <span className="font-extrabold text-base text-[#1A2333]">
                  {empresa.razaoSocial}
                </span>
                {empresa.nomeFantasia && (
                  <span className="text-xs text-[#0FA3A3] font-semibold block">
                    Nome Fantasia: {empresa.nomeFantasia}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-[#1A2333] block">
                  CNPJ: {empresa.cnpj}
                </span>
                <span className="text-[11px] text-[#64748B]">
                  Regime: {empresa.regime.replace('_', ' ').toUpperCase()} • Porte:{' '}
                  {(empresa.porte || 'Não especificado').toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
              <div>
                <span className="text-[#64748B] block">Setor / Atividade:</span>
                <span
                  className="font-semibold text-[#1A2333] block truncate"
                  title={empresa.setorNome}
                >
                  {empresa.setorNome}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">CNAE Identificado:</span>
                <span className="font-semibold text-[#1A2333] font-mono">
                  {empresa.cnaeDetectado || 'Não classificado formalmente'}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Tratamento Tributário:</span>
                <span className="font-semibold text-emerald-700">{empresa.tratamentoBadge}</span>
              </div>
              <div>
                <span className="text-[#64748B] block">Base de Faturamento:</span>
                <span className="font-semibold text-[#1A2333]">
                  {formatBRL(empresa.faturamentoBase)} / ano
                </span>
                <span className="text-[9px] text-[#0FA3A3] block">
                  Origem: {empresa.origemDescricao}
                </span>
              </div>
            </div>
          </div>

          {/* SÍNTESE EXECUTIVA DE IMPACTO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-[10px] uppercase font-bold text-[#64748B]">
                Carga Tributária Atual Estimada
              </span>
              <p className="text-base font-extrabold text-[#1A2333] mt-0.5">
                {formatBRL(empresa.cargaAtualReais)} / ano
              </p>
              <span className="text-[10px] text-[#64748B]">
                Alíquota efetiva estimada: {empresa.aliquotaAtualEfetiva}%
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-[10px] uppercase font-bold text-[#64748B]">
                Carga Plena Projetada (2033)
              </span>
              <p className="text-base font-extrabold text-[#1A2333] mt-0.5">
                {formatBRL(empresa.carga2033Reais)} / ano
              </p>
              <span className="text-[10px] text-[#64748B]">
                Alíquota efetiva IBS/CBS: {empresa.aliquota2033Efetiva}%
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-[10px] uppercase font-bold text-[#64748B]">
                Impacto Acumulado na Transição
              </span>
              <p
                className={`text-base font-extrabold mt-0.5 ${
                  empresa.impactoAcumuladoReais > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {empresa.impactoAcumuladoReais > 0 ? '+' : ''}
                {formatBRL(empresa.impactoAcumuladoReais)}
              </p>
              <span className="text-[10px] text-[#64748B]">
                Variação no regime pleno: {empresa.variacao2033Percentual > 0 ? '+' : ''}
                {empresa.variacao2033Percentual}%
              </span>
            </div>
          </div>

          {/* DESTAQUE: ESTRATÉGIA RECOMENDADA PELO MOTOR */}
          <div className="rounded-xl border-2 border-[#0FA3A3]/40 bg-teal-50/40 p-4 text-xs space-y-3">
            <div className="flex items-center gap-2 text-[#0E7A7A] font-bold uppercase tracking-wider text-xs border-b border-teal-200 pb-2">
              <Lightbulb className="h-4 w-4" />
              <span>Estratégia Recomendada para o Cliente</span>
            </div>

            <div className="space-y-2 text-xs text-[#1A2333]">
              {calculada?.resumo?.recomendacoes && calculada.resumo.recomendacoes.length > 0 ? (
                calculada.resumo.recomendacoes.map((rec, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 bg-white/80 p-2.5 rounded-lg border border-teal-100"
                  >
                    <span className="h-4 w-4 rounded-full bg-[#0FA3A3] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="leading-relaxed font-medium">{rec}</p>
                  </div>
                ))
              ) : (
                <div className="p-2.5 bg-white/80 rounded-lg">
                  <p className="leading-relaxed font-medium">
                    Manter o monitoramento trimestral dos lançamentos contábeis e atualizar o plano
                    orçamentário conforme as regulamentações complementares do Comitê Gestor do IBS.
                  </p>
                </div>
              )}
            </div>

            <div className="text-[11px] text-[#0E7A7A] font-semibold pt-1 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>
                Ponto Crítico Identificado:{' '}
                {calculada?.resumo?.pontoCritico ||
                  'Ano de 2027 (início da CBS plena) e 2033 (encerramento de benefícios transitórios).'}
              </span>
            </div>
          </div>

          {/* TABELA DE TRANSIÇÃO ANO A ANO 2026-2033 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-1">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#123B6D] flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#0FA3A3]" />
                Cronograma de Transição Tributária (2026 a 2033)
              </h4>
              <span className="text-[10px] text-[#64748B]">EC 132/23 & LC 214/25</span>
            </div>

            <table className="w-full text-left text-xs border border-slate-200 divide-y divide-slate-200">
              <thead className="bg-slate-100 font-bold text-[10px] uppercase text-[#64748B]">
                <tr>
                  <th className="py-2.5 px-3">Ano</th>
                  <th className="py-2.5 px-3">Fase Legal</th>
                  <th className="py-2.5 px-3 text-right">Carga Atual (R$)</th>
                  <th className="py-2.5 px-3 text-right">Alíq. IBS/CBS</th>
                  <th className="py-2.5 px-3 text-right">Carga Projetada (R$)</th>
                  <th className="py-2.5 px-3 text-right">Diferença (R$)</th>
                  <th className="py-2.5 px-3 text-right">Variação %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-[11px]">
                {calculada?.tabelaAnual ? (
                  calculada.tabelaAnual.map((item) => (
                    <tr key={item.ano} className={item.ano === 2033 ? 'bg-slate-50 font-bold' : ''}>
                      <td className="py-2 px-3 font-mono font-bold">{item.ano}</td>
                      <td className="py-2 px-3 text-[#475569]">{item.descricao}</td>
                      <td className="py-2 px-3 text-right font-mono text-[#64748B]">
                        {formatBRL(item.cargaAtualEstimadaReais)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {item.aliquotaNominalCombinada}%
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-[#1A2333]">
                        {formatBRL(item.cargaProjetadaIBSCBSReais)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-mono font-semibold ${
                          item.diferencaReais > 0
                            ? 'text-amber-700'
                            : item.diferencaReais < 0
                              ? 'text-emerald-700'
                              : 'text-slate-600'
                        }`}
                      >
                        {item.diferencaReais > 0 ? '+' : ''}
                        {formatBRL(item.diferencaReais)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.diferencaPercentual > 0
                              ? 'bg-amber-100 text-amber-800'
                              : item.diferencaPercentual < 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.diferencaPercentual > 0 ? '+' : ''}
                          {item.diferencaPercentual}%
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-500">
                      Cálculo detalhado requer faturamento base informado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* PRÓXIMAS DATAS CRÍTICAS DO CRONOGRAMA */}
          <div className="space-y-2 pt-1 border-t border-slate-200">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#123B6D] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#0FA3A3]" />
              Próximas Datas Críticas & Ações do Escritório
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {cronogramaDatasCriticas.map((etapa, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#123B6D] text-[11px]">{etapa.data}</span>
                    <Badge variant="outline" className="text-[9px] border-slate-300">
                      Marco Legal
                    </Badge>
                  </div>
                  <p className="text-[11px] text-[#1A2333] font-medium leading-tight">
                    {etapa.fato}
                  </p>
                  <p className="text-[10px] text-[#64748B] leading-tight">
                    <b>Ação recomendada:</b> {etapa.impacto}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* NOTA METODOLÓGICA & BASE LEGAL */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-950">
            <Info className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Fundamentação e Governança do Modelo:</span>
              <p className="mt-0.5 text-[11px] text-blue-900 leading-normal">
                Este relatório foi gerado pelo módulo de inteligência fiscal da Plataforma Rumo,
                fundamentado nas regras da Emenda Constitucional nº 132/2023, Lei Complementar nº
                214/2025 e cronograma do ADCT. A recalculação das projeções ocorre em rodadas
                trimestrais agendadas e os parâmetros normativos são atualizados centralmente
                conforme novas deliberações do Comitê Gestor do IBS e RFB.
                {calculada?.parametrosUtilizados?.fonte && (
                  <span className="block mt-1 font-semibold text-blue-950">
                    • Fonte Paramétrica Vigente: {calculada.parametrosUtilizados.fonte}
                    {calculada.parametrosUtilizados.isCustomizado
                      ? ' (Parâmetros Customizados do Escritório)'
                      : ''}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* RESSALVA DE TRANSPARÊNCIA E CONFORMIDADE CFC */}
          <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-950">
            <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Ressalva Metodológica Regulatória (CFC):</span>
              <p className="mt-0.5 text-[11px] text-amber-900 leading-normal">
                Este dossiê consiste em{' '}
                <b>
                  projeção e estimativa preliminar baseada em modelos matemáticos e cenários fiscais
                </b>{' '}
                da EC 132/2023 e LC 214/2025. Não representa parecer tributário definitivo nem
                garantia de resultado patrimonial, dependendo da publicação de atos executivos do
                Comitê Gestor do IBS e da Secretaria Especial da Receita Federal do Brasil.
              </p>
            </div>
          </div>

          {/* CAMPO DE ASSINATURA DO RESPONSÁVEL TÉCNICO */}
          <div className="pt-8 border-t border-slate-300 flex justify-between items-end text-xs">
            <div>
              <p className="text-[10px] text-[#94A3B8]">
                Plataforma Contábil Rumo • Parecer Individual de Reforma Tributária
              </p>
              <p className="text-[10px] text-[#94A3B8]">
                Documento técnico para uso exclusivo em reuniões de planejamento tributário
              </p>
            </div>
            <div className="text-center w-72 border-t border-slate-400 pt-1.5 space-y-0.5">
              <p className="font-bold text-[#1A2333]">{tenantNome}</p>
              <p className="text-[11px] text-[#64748B]">Responsável Técnico Contábil</p>
              <p className="text-[10px] text-[#94A3B8]">{crcEscritorio}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

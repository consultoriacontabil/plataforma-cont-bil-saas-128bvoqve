import { useState } from 'react'
import {
  Sliders,
  RotateCcw,
  Save,
  History,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { parametrosReformaService } from '@/services/parametrosReforma'
import { PARAMETROS_REFORMA } from '@/lib/reformaTributaria/parametros'
import { formatDatePtBr } from '@/lib/formatters'
import type { ParametrosReformaRecord, ParametrosReformaConfig } from '@/types'

interface ParametrosReformaTabProps {
  parametroAtivo: ParametrosReformaRecord | null
  historico: ParametrosReformaRecord[]
  canEdit: boolean // só Administrador edita; Contador visualiza
  onReload: () => void
}

export function ParametrosReformaTab({
  parametroAtivo,
  historico,
  canEdit,
  onReload,
}: ParametrosReformaTabProps) {
  const { tenant, user } = useAuth()
  const { toast } = useToast()

  // Base inicial do formulário: parâmetro ativo se existir, senão o padrão do código
  const configInicial: ParametrosReformaConfig =
    parametroAtivo?.parametros_json || parametrosReformaService.getPadraoCodigo()

  const [fonte, setFonte] = useState<string>(
    parametroAtivo
      ? parametroAtivo.fonte
      : 'Comitê Gestor do IBS / RFB — Resolução Normativa nº 01/2026',
  )
  const [descricaoAlteracao, setDescricaoAlteracao] = useState<string>('')

  // Campos numéricos editáveis
  const [cbsAliquota, setCbsAliquota] = useState<number>(configInicial.aliquotaReferenciaPlena.cbs)
  const [ibsAliquota, setIbsAliquota] = useState<number>(configInicial.aliquotaReferenciaPlena.ibs)
  const [reducaoSetorial, setReducaoSetorial] = useState<number>(
    configInicial.reducoes.setoresPrioritarios60 * 100,
  )
  const [reducaoProfissoes, setReducaoProfissoes] = useState<number>(
    (configInicial.reducoes.profissoesRegulamentadas30 || 0.3) * 100,
  )
  const [sublimiteSimples, setSublimiteSimples] = useState<number>(
    configInicial.simplesNacional.sublimiteTransicional,
  )
  const [descontoSimples, setDescontoSimples] = useState<number>(
    configInicial.simplesNacional.descontoTransicaoSimplesSublimite * 100,
  )

  // Cronograma de transição editável (ano a ano)
  const [calendario, setCalendario] = useState(configInicial.calendarioTransicao)

  const [saving, setSaving] = useState(false)
  const [reverting, setReverting] = useState(false)

  // Alíquota combinada total
  const aliquotaTotalCalculada = Number((cbsAliquota + ibsAliquota).toFixed(2))

  // Alterar CBS/IBS no calendário
  const handleAtualizarAnoCBS = (ano: number, val: number) => {
    setCalendario((prev) => prev.map((c) => (c.ano === ano ? { ...c, aliquotaCBS: val } : c)))
  }

  const handleAtualizarAnoIBS = (ano: number, val: number) => {
    setCalendario((prev) => prev.map((c) => (c.ano === ano ? { ...c, aliquotaIBS: val } : c)))
  }

  const handleAtualizarAnoFatorAntigos = (ano: number, val: number) => {
    setCalendario((prev) =>
      prev.map((c) => (c.ano === ano ? { ...c, fatorTributosAntigos: val } : c)),
    )
  }

  // Ação Salvar Nova Versão
  const handleSalvarNovaVersao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) {
      toast({
        title: 'Permissão negada',
        description: 'Apenas Administradores podem atualizar as alíquotas da Reforma.',
        variant: 'destructive',
      })
      return
    }

    if (!fonte.trim()) {
      toast({
        title: 'Fonte normativa obrigatória',
        description: 'Informe a origem normativa ou resolução dos parâmetros (ex.: Comitê Gestor).',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      const novaConfig: ParametrosReformaConfig = {
        versaoNormativa: `Customizada (Fonte: ${fonte.trim()})`,
        fonte: fonte.trim(),
        aliquotaReferenciaPlena: {
          cbs: Number(cbsAliquota),
          ibs: Number(ibsAliquota),
          total: aliquotaTotalCalculada,
        },
        reducoes: {
          setoresPrioritarios60: Number(reducaoSetorial) / 100,
          profissoesRegulamentadas30: Number(reducaoProfissoes) / 100,
          cestaBasicaNacional: 1.0,
        },
        simplesNacional: {
          sublimiteTransicional: Number(sublimiteSimples),
          tetoMaximoSimples: 4800000,
          descontoTransicaoSimplesSublimite: Number(descontoSimples) / 100,
        },
        calendarioTransicao: calendario,
      }

      await parametrosReformaService.salvarNovaVersao(tenant!.id, {
        fonte,
        descricaoAlteracao:
          descricaoAlteracao ||
          `Ajuste de alíquotas de referência (CBS ${cbsAliquota}% + IBS ${ibsAliquota}% = ${aliquotaTotalCalculada}%)`,
        parametros: novaConfig,
        userId: user?.id,
      })

      toast({
        title: 'Parâmetros atualizados com sucesso!',
        description:
          'O simulador, ranking setorial e comparador passarão a usar os novos parâmetros imediatamente.',
      })
      setDescricaoAlteracao('')
      onReload()
    } catch (err: any) {
      console.error('Erro ao salvar parâmetros:', err)
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Falha ao gravar versão parametrizada.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Ação Reverter para Versão do Histórico
  const handleReverterVersao = async (versaoId: string) => {
    if (!canEdit) return
    try {
      setReverting(true)
      await parametrosReformaService.reverterParaVersao(tenant!.id, versaoId, user?.id)
      toast({
        title: 'Versão reativada!',
        description: 'A versão selecionada foi definida como a configuração ativa do tenant.',
      })
      onReload()
    } catch (err: any) {
      toast({
        title: 'Erro ao reverter versão',
        description: err?.message || 'Não foi possível reverter.',
        variant: 'destructive',
      })
    } finally {
      setReverting(false)
    }
  }

  // Ação Restaurar Padrão do Código
  const handleRestaurarPadrao = async () => {
    if (!canEdit) return
    if (
      !confirm(
        'Deseja realmente desativar parâmetros customizados e restaurar os valores padrão do código (LC 214/2025 e EC 132/2023)?',
      )
    )
      return

    try {
      setReverting(true)
      await parametrosReformaService.restaurarPadraoCodigo(tenant!.id, user?.id)
      toast({
        title: 'Padrão do código restaurado!',
        description: 'O simulador voltou a utilizar os valores legais padrão do sistema.',
      })

      // Restaurar estado dos campos
      const padrao = parametrosReformaService.getPadraoCodigo()
      setFonte(padrao.fonte)
      setCbsAliquota(padrao.aliquotaReferenciaPlena.cbs)
      setIbsAliquota(padrao.aliquotaReferenciaPlena.ibs)
      setReducaoSetorial(padrao.reducoes.setoresPrioritarios60 * 100)
      setReducaoProfissoes((padrao.reducoes.profissoesRegulamentadas30 || 0.3) * 100)
      setSublimiteSimples(padrao.simplesNacional.sublimiteTransicional)
      setDescontoSimples(padrao.simplesNacional.descontoTransicaoSimplesSublimite * 100)
      setCalendario(padrao.calendarioTransicao)

      onReload()
    } catch (err: any) {
      toast({
        title: 'Erro ao restaurar',
        description: err?.message || 'Falha ao restaurar padrão.',
        variant: 'destructive',
      })
    } finally {
      setReverting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner de Estado Atual dos Parâmetros */}
      {parametroAtivo ? (
        <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-teal-600 text-white shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">
                  Parâmetros Customizados Ativos (Versão {parametroAtivo.versao})
                </span>
                <Badge className="bg-teal-600 text-white text-[10px] uppercase font-bold">
                  Em Vigor no Tenant
                </Badge>
              </div>
              <p className="text-xs text-teal-800 mt-0.5">
                <strong>Fonte Oficial:</strong> {parametroAtivo.fonte} • <strong>CBS:</strong>{' '}
                {parametroAtivo.parametros_json.aliquotaReferenciaPlena.cbs}% •{' '}
                <strong>IBS:</strong> {parametroAtivo.parametros_json.aliquotaReferenciaPlena.ibs}%
                • <strong>Total Pleno:</strong>{' '}
                {parametroAtivo.parametros_json.aliquotaReferenciaPlena.total}%
              </p>
              <p className="text-[11px] text-teal-700 mt-0.5">
                Última atualização em{' '}
                {formatDatePtBr(parametroAtivo.updated || parametroAtivo.created)}
                {parametroAtivo.expand?.atualizado_por &&
                  ` por ${parametroAtivo.expand.atualizado_por.name}`}
              </p>
            </div>
          </div>

          {canEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={reverting}
              onClick={handleRestaurarPadrao}
              className="rounded-xl border-teal-300 text-teal-900 hover:bg-teal-100 text-xs gap-1.5 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Voltar ao Padrão do Código</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-[#1A2333] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-slate-200 text-slate-700 shrink-0">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">Parâmetros Legais Padrão em Uso</span>
                <Badge
                  variant="outline"
                  className="border-slate-300 text-slate-700 text-[10px] uppercase"
                >
                  Fallback Nativo
                </Badge>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Fonte: {PARAMETROS_REFORMA.fonte} ({PARAMETROS_REFORMA.versaoNormativa})
              </p>
              <p className="text-[11px] text-[#64748B]">
                CBS: 8,80% • IBS: 17,70% • Alíquota Plena: 26,50% • Redução Setorial: 60%
              </p>
            </div>
          </div>

          {!canEdit && (
            <span className="text-xs text-slate-500 italic">
              Apenas administradores podem parametrizar novas alíquotas.
            </span>
          )}
        </div>
      )}

      {/* Formulário de Edição de Parâmetros */}
      <form onSubmit={handleSalvarNovaVersao} className="space-y-6">
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
              <Sliders className="h-5 w-5 text-[#0FA3A3]" />
              <span>Alíquotas de Referência e Regras Centrais (EC 132/2023)</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Valores adotados para as simulações quando a reforma atingir o regime pleno (a partir
              de 2033) e nas reduções tributárias setoriais.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Alíquota CBS de Referência (%) *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  disabled={!canEdit}
                  value={cbsAliquota}
                  onChange={(e) => setCbsAliquota(Number(e.target.value))}
                  className="h-9 rounded-xl border-[#E2E8F0] text-xs font-bold"
                />
                <p className="text-[10px] text-[#64748B]">Padrão legal: 8,80%</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Alíquota IBS de Referência (%) *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  disabled={!canEdit}
                  value={ibsAliquota}
                  onChange={(e) => setIbsAliquota(Number(e.target.value))}
                  className="h-9 rounded-xl border-[#E2E8F0] text-xs font-bold"
                />
                <p className="text-[10px] text-[#64748B]">Padrão legal: 17,70%</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Alíquota Plena Combinada (IBS + CBS)
                </Label>
                <div className="h-9 rounded-xl border border-teal-200 bg-teal-50/50 flex items-center px-3 font-mono font-black text-[#0FA3A3] text-sm">
                  {aliquotaTotalCalculada.toFixed(2)}%
                </div>
                <p className="text-[10px] text-[#64748B]">Soma automática CBS + IBS</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Redução Setores Prioritários (%)
                </Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  disabled={!canEdit}
                  value={reducaoSetorial}
                  onChange={(e) => setReducaoSetorial(Number(e.target.value))}
                  className="h-9 rounded-xl border-[#E2E8F0] text-xs"
                />
                <p className="text-[10px] text-[#64748B]">Padrão: 60% (Saúde, Educação, Agro)</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Redução Profissões Regulamentadas (%)
                </Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  disabled={!canEdit}
                  value={reducaoProfissoes}
                  onChange={(e) => setReducaoProfissoes(Number(e.target.value))}
                  className="h-9 rounded-xl border-[#E2E8F0] text-xs"
                />
                <p className="text-[10px] text-[#64748B]">Padrão: 30% (LC 214/2025)</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Sublimite Transição Simples (R$)
                </Label>
                <Input
                  type="number"
                  step="100000"
                  min="0"
                  disabled={!canEdit}
                  value={sublimiteSimples}
                  onChange={(e) => setSublimiteSimples(Number(e.target.value))}
                  className="h-9 rounded-xl border-[#E2E8F0] text-xs font-mono"
                />
                <p className="text-[10px] text-[#64748B]">Padrão: R$ 3.600.000,00</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Desconto Simples no Sublimite (%)
                </Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  disabled={!canEdit}
                  value={descontoSimples}
                  onChange={(e) => setDescontoSimples(Number(e.target.value))}
                  className="h-9 rounded-xl border-[#E2E8F0] text-xs"
                />
                <p className="text-[10px] text-[#64748B]">Padrão: 50% de redução na transição</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Fonte / Base Normativa *
                </Label>
                <Input
                  disabled={!canEdit}
                  value={fonte}
                  onChange={(e) => setFonte(e.target.value)}
                  placeholder="Ex.: Comitê Gestor do IBS — Resolução nº 02/2026"
                  className="h-9 rounded-xl border-[#E2E8F0] text-xs"
                />
                <p className="text-[10px] text-[#64748B]">
                  Esta fonte será impressa em relatórios executivos e exibida no banner de
                  transparência.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">
                  Descrição / Motivo da Alteração
                </Label>
                <Input
                  disabled={!canEdit}
                  value={descricaoAlteracao}
                  onChange={(e) => setDescricaoAlteracao(e.target.value)}
                  placeholder="Ex.: Atualização da alíquota plena após publicação do Comitê Gestor"
                  className="h-9 rounded-xl border-[#E2E8F0] text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cronograma de Transição 2026 - 2033 */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#0FA3A3]" />
              <span>Cronograma Transicional de Alíquotas (2026 – 2033)</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Percentuais progressivos aplicados durante os anos da transição tributária.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#64748B] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Ano</th>
                    <th className="py-2.5 px-3">Fase Legal</th>
                    <th className="py-2.5 px-3">Alíquota CBS (%)</th>
                    <th className="py-2.5 px-3">Alíquota IBS (%)</th>
                    <th className="py-2.5 px-3">Fator Tributos Antigos</th>
                    <th className="py-2.5 px-3">Descrição Resumida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {calendario.map((cal) => (
                    <tr key={cal.ano} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#0FA3A3]">{cal.ano}</td>
                      <td className="py-2.5 px-3 capitalize font-semibold text-slate-700">
                        {cal.fase.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 px-3">
                        <Input
                          type="number"
                          step="0.01"
                          disabled={!canEdit}
                          value={cal.aliquotaCBS}
                          onChange={(e) => handleAtualizarAnoCBS(cal.ano, Number(e.target.value))}
                          className="h-8 w-24 text-xs font-mono rounded-lg border-[#E2E8F0]"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <Input
                          type="number"
                          step="0.01"
                          disabled={!canEdit}
                          value={cal.aliquotaIBS}
                          onChange={(e) => handleAtualizarAnoIBS(cal.ano, Number(e.target.value))}
                          className="h-8 w-24 text-xs font-mono rounded-lg border-[#E2E8F0]"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          disabled={!canEdit}
                          value={cal.fatorTributosAntigos}
                          onChange={(e) =>
                            handleAtualizarAnoFatorAntigos(cal.ano, Number(e.target.value))
                          }
                          className="h-8 w-20 text-xs font-mono rounded-lg border-[#E2E8F0]"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-[#64748B] text-[11px] max-w-xs truncate">
                        {cal.descricao}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canEdit && (
              <div className="pt-4 flex items-center justify-end gap-3">
                <Button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#0FA3A3] hover:bg-[#0D8B8B] text-white text-xs font-semibold px-4 gap-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? 'Gravando Versão...' : 'Salvar e Ativar Parâmetros'}</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
      {/* Histórico de Versões Customizadas */}
      <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
            <History className="h-5 w-5 text-[#0FA3A3]" />
            <span>Histórico de Versões Parametrizadas</span>
          </CardTitle>
          <CardDescription className="text-xs text-[#64748B]">
            Todas as alterações ficam auditadas e podem ser reativadas a qualquer momento.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-2">
          {historico.length === 0 ? (
            <p className="text-xs text-[#64748B] py-4 text-center">
              Nenhuma versão customizada gravada anteriormente. O sistema está utilizando o padrão
              do código.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-xl overflow-hidden">
              {historico.map((h) => {
                const isCurrent = h.ativo
                const params = h.parametros_json
                return (
                  <div
                    key={h.id}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCurrent ? 'bg-teal-50/40' : 'bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#0B1F3A]">Versão {h.versao}</span>
                        {isCurrent ? (
                          <Badge className="bg-emerald-600 text-white text-[9px] uppercase font-bold">
                            Ativa Atualmente
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] uppercase text-slate-500">
                            Histórico
                          </Badge>
                        )}
                        <span className="text-[11px] text-[#64748B] font-mono">
                          • CBS: {params.aliquotaReferenciaPlena?.cbs}% | IBS:{' '}
                          {params.aliquotaReferenciaPlena?.ibs}% (Total:{' '}
                          {params.aliquotaReferenciaPlena?.total}%)
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 mt-1">
                        <strong>Fonte:</strong> {h.fonte}
                        {h.descricao_alteracao && ` — ${h.descricao_alteracao}`}
                      </p>

                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Registrado em {formatDatePtBr(h.created)}
                        {h.expand?.atualizado_por && ` por ${h.expand.atualizado_por.name}`}
                      </p>
                    </div>

                    {!isCurrent && canEdit && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={reverting}
                        onClick={() => handleReverterVersao(h.id)}
                        className="rounded-xl text-xs border-slate-200 hover:bg-slate-100 gap-1.5 shrink-0"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Reativar Versão {h.versao}</span>
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

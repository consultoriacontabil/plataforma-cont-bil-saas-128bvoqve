/**
 * Módulo Financeiro do Escritório — modelo Makro (Fatia 3).
 * Layout de 3 zonas do Makro System: cabeçalho (Escritório + Competência),
 * sidebar secundária com as 5 fases e área central de grades.
 *
 * Diferente dos módulos Fiscal/Pessoal, o financeiro aqui é do ESCRITÓRIO
 * (não por cliente): contas bancárias, categorias, honorários dos contratos,
 * títulos a receber/pagar, caixa e resultados (DRE + evolutivo).
 *
 * Fases:
 *  - Cadastros: contas (caixa/banco), categorias e honorários (importação dos contratos)
 *  - Recebimentos: títulos a receber do mês + geração em lote + baixa (entrada no caixa)
 *  - Pagamentos: contas a pagar do escritório + baixa (saída no caixa)
 *  - Caixa: extrato por conta (saldo inicial ± movimentos)
 *  - Resultados: DRE gerencial + comparativo esperado × cobrado × recebido
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2,
  CalendarDays,
  Wallet,
  ClipboardList,
  ArrowDownToLine,
  ArrowUpFromLine,
  Landmark,
  BarChart3,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import type { Empresa } from '@/types'
import { competenciaAtualEscritorio } from '@/services/financeiroEscritorio'
import { CadastrosFase, RecebimentosFase } from '@/components/financeiro/FaseCadastrosRecebimentos'
import { PagamentosFase } from '@/components/financeiro/FasePagamentos'
import { CaixaFase } from '@/components/financeiro/FaseCaixa'
import { ResultadosFase } from '@/components/financeiro/FaseResultados'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDateTimePtBr } from '@/lib/formatters'

const MESES_EXTENSO = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

interface FaseFinanceiro {
  id: 'cadastros' | 'recebimentos' | 'pagamentos' | 'caixa' | 'resultados'
  label: string
  icone: React.ComponentType<{ className?: string }>
  descricao: string
}

const FASES_FINANCEIRO: FaseFinanceiro[] = [
  {
    id: 'cadastros',
    label: 'Cadastros',
    icone: ClipboardList,
    descricao:
      'Contas de caixa/banco do escritório, categorias de receita/despesa e honorários mensais fixos — com importação dos honorários já definidos nos contratos assinados.',
  },
  {
    id: 'recebimentos',
    label: 'Recebimentos',
    icone: ArrowDownToLine,
    descricao:
      'Títulos a receber do mês: geração em lote a partir dos honorários fixos, receitas avulsas e baixa em lote (cada baixa lança entrada no caixa).',
  },
  {
    id: 'pagamentos',
    label: 'Pagamentos',
    icone: ArrowUpFromLine,
    descricao:
      'Contas a pagar do escritório — fixas recorrentes (folha, aluguel, softwares) e avulsas — com baixa em lote (cada baixa lança saída no caixa).',
  },
  {
    id: 'caixa',
    label: 'Caixa',
    icone: Landmark,
    descricao:
      'Extrato por conta: saldo = saldo inicial ± movimentos da competência (entradas das baixas de recebimentos + saídas das baixas de pagamentos e lançamentos avulsos).',
  },
  {
    id: 'resultados',
    label: 'Resultados',
    icone: BarChart3,
    descricao:
      'DRE gerencial da competência (regime de caixa) e comparativo esperado (honorários ativos) × cobrado (títulos gerados) × recebido (baixas).',
  },
]

export default function ModuloFinanceiroPage() {
  const { tenant, user } = useAuth()
  const [empresas, setEmpresas] = useState<Array<{ id: string; nome: string }>>([])
  const [competencia, setCompetencia] = useState<string>(competenciaAtualEscritorio())
  const [faseAtiva, setFaseAtiva] = useState<FaseFinanceiro['id']>('cadastros')
  const [versao, setVersao] = useState(0)
  const [refreshAgora, setRefreshAgora] = useState(0)
  const [ultimoRefresh, setUltimoRefresh] = useState<string | null>(null)

  // Empresas da carteira — usadas para vincular honorários e receitas aos clientes
  useEffect(() => {
    if (!tenant?.id) return
    let cancelado = false
    empresasService
      .list(tenant.id)
      .then((lista) => {
        if (cancelado) return
        setEmpresas(
          lista.map((e: Empresa) => ({
            id: e.id,
            nome: e.nome_fantasia || e.razao_social || 'Sem nome',
          })),
        )
      })
      .catch(() => {
        if (!cancelado) setEmpresas([])
      })
    return () => {
      cancelado = true
    }
  }, [tenant?.id])

  const aoMudar = useCallback(() => {
    setVersao((v) => v + 1)
    setUltimoRefresh(new Date().toISOString())
  }, [])

  const recarregarTudo = useCallback(() => {
    setVersao((v) => v + 1)
    setRefreshAgora((r) => r + 1)
    setUltimoRefresh(new Date().toISOString())
  }, [])

  const fase = FASES_FINANCEIRO.find((f) => f.id === faseAtiva) || FASES_FINANCEIRO[0]

  const competenciaLabel = useMemo(() => {
    const [ano, mes] = competencia.split('-')
    if (!mes || !ano) return competencia
    return `${MESES_EXTENSO[Number(mes) - 1] || mes}/${ano}`
  }, [competencia])

  return (
    <div className="space-y-5 animate-fade-in pb-10">
      {/* Zona 1: Cabeçalho com Escritório + Competência */}
      <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label
              htmlFor="escritorio-financeiro"
              className="text-[11px] font-semibold text-[#64748B]"
            >
              Escritório
            </label>
            <div
              id="escritorio-financeiro"
              className="h-9 flex items-center gap-2 rounded-md border border-input bg-transparent px-3 text-xs font-medium text-[#1A2333]"
            >
              <Building2 className="h-3.5 w-3.5 text-[#0FA3A3] shrink-0" />
              {tenant?.nome || 'Financeiro do escritório'}
              <Badge
                variant="outline"
                className="ml-auto text-[9px] font-bold bg-slate-50 text-slate-500 border-slate-200"
              >
                Escritório (não por cliente)
              </Badge>
            </div>
          </div>
          <div className="w-full sm:w-52 space-y-1.5">
            <label
              htmlFor="competencia-financeiro"
              className="text-[11px] font-semibold text-[#64748B]"
            >
              Competência
            </label>
            <Input
              id="competencia-financeiro"
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs"
            onClick={recarregarTudo}
            aria-label="Recarregar dados do financeiro"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', refreshAgora >= 0 && 'motion-safe:animate-none')}
            />
            Recarregar
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <h2 className="text-lg font-bold text-[#1A2333]">Financeiro do Escritório</h2>
          <Badge
            variant="outline"
            className="text-[10px] font-bold bg-[#0FA3A3]/10 text-[#0FA3A3] border-[#0FA3A3]/30"
          >
            Módulo Financeiro
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] font-bold bg-slate-50 text-slate-600 border-slate-200"
          >
            <CalendarDays className="h-3 w-3 mr-1" />
            {competenciaLabel}
          </Badge>
        </div>
        <p className="text-xs text-[#64748B] mt-1">
          Financeiro do próprio escritório: cadastros, recebimentos (honorários), pagamentos, caixa
          e resultados — o Faturamento Recorrente dos contratos continua em{' '}
          <strong>Contratos → Faturamento</strong>.
        </p>
      </Card>

      {/* Zona 2 + 3: sidebar de fases + área central */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
        <nav aria-label="Fases do módulo Financeiro" className="space-y-1">
          {FASES_FINANCEIRO.map((f) => {
            const Icone = f.icone
            const ativo = f.id === faseAtiva
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFaseAtiva(f.id)}
                className={cn(
                  'w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors text-left',
                  ativo ? 'bg-[#0FA3A3] text-white shadow-sm' : 'text-[#64748B] hover:bg-slate-100',
                )}
                aria-current={ativo ? 'page' : undefined}
              >
                <Icone className="h-4 w-4 shrink-0" />
                {f.label}
              </button>
            )
          })}
          {ultimoRefresh && (
            <p className="text-[10px] text-slate-400 px-3 pt-2">
              Atualizado {formatDateTimePtBr(ultimoRefresh)}
            </p>
          )}
        </nav>

        <div className="space-y-4">
          <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-[#0FA3A3]/10 p-2 shrink-0">
                <fase.icone className="h-5 w-5 text-[#0FA3A3]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1A2333]">Fase: {fase.label}</h3>
                <p className="text-xs text-[#64748B] mt-0.5">{fase.descricao}</p>
              </div>
            </div>
          </Card>

          {faseAtiva === 'cadastros' && (
            <CadastrosFase
              key={`cad-${versao}`}
              tenantId={tenant?.id}
              usuarioId={user?.id}
              empresas={empresas}
              aoMudar={aoMudar}
            />
          )}

          {faseAtiva === 'recebimentos' && (
            <RecebimentosFase
              key={`rec-${versao}`}
              tenantId={tenant?.id}
              usuarioId={user?.id}
              empresas={empresas}
              competencia={competencia}
              aoMudar={aoMudar}
            />
          )}

          {faseAtiva === 'pagamentos' && (
            <PagamentosFase
              key={`pag-${versao}`}
              tenantId={tenant?.id}
              usuarioId={user?.id}
              competencia={competencia}
              aoMudar={aoMudar}
            />
          )}

          {faseAtiva === 'caixa' && (
            <CaixaFase
              key={`caixa-${versao}`}
              tenantId={tenant?.id}
              usuarioId={user?.id}
              competencia={competencia}
              aoMudar={aoMudar}
            />
          )}

          {faseAtiva === 'resultados' && (
            <ResultadosFase key={`res-${versao}`} tenantId={tenant?.id} competencia={competencia} />
          )}
        </div>
      </div>
    </div>
  )
}

// Reexportado para padronizar import nas páginas Makro (ícone usado no cabeçalho)
export { Wallet }

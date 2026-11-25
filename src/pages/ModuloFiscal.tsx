/**
 * Módulo Fiscal — modelo Makro (Fatia 2).
 * Layout de 3 zonas do Makro System: cabeçalho (Empresa + Competência),
 * sidebar secundária com as 4 fases e área central de grades.
 *
 * Fases:
 *  - Preparar: importação em lote de XMLs (upload manual + GED da Elliza)
 *  - Movimentações: grades de entradas, saídas e serviços (fiscalMakro)
 *  - Obrigações: apuração por regime + link para o SPED existente (/fiscal?tab=sped)
 *  - Relatórios: relatório Estado/CFOP e serviços municipais (fiscalMakro)
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Users,
  CalendarDays,
  ClipboardList,
  Layers,
  FileText,
  BarChart3,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import type { Empresa } from '@/types'
import { listarMovimentos, competenciaAtual, type MovimentoFiscal } from '@/services/fiscalMakro'
import { PrepararFase, MovimentacoesFase } from '@/components/fiscal/FiscalFasesPreparar'
import { ObrigacoesFase, RelatoriosFase } from '@/components/fiscal/FiscalFasesObrigacoesRelatorios'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

interface FaseFiscal {
  id: 'preparar' | 'movimentacoes' | 'obrigacoes' | 'relatorios'
  label: string
  icone: React.ComponentType<{ className?: string }>
  descricao: string
}

const FASES_FISCAL: FaseFiscal[] = [
  {
    id: 'preparar',
    label: 'Preparar',
    icone: ClipboardList,
    descricao:
      'Importação em lote dos XMLs de NF-e/NFS-e da competência (upload manual ou GED da Elliza), com cadastro automático de produtos e fornecedores.',
  },
  {
    id: 'movimentacoes',
    label: 'Movimentações',
    icone: Layers,
    descricao:
      'Movimentações fiscais do mês: entradas, saídas e serviços prestados/tomados, com ICMS, ICMS-ST e FCP-ST por documento.',
  },
  {
    id: 'obrigacoes',
    label: 'Obrigações',
    icone: FileText,
    descricao:
      'Apuração por regime (Simples Nacional, Presumido, Real) e acesso ao SPED & Escrituração (ECD/ECF/EFD) já existente na plataforma.',
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    icone: BarChart3,
    descricao:
      'Relatório Estado/CFOP (base de cálculo, ICMS, ICMS-ST, FCP-ST, isentas) e serviços municipais (NFS-e) da competência.',
  },
]

export default function ModuloFiscalPage() {
  const { tenant } = useAuth()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState<string>('none')
  const [competencia, setCompetencia] = useState<string>(competenciaAtual())
  const [faseAtiva, setFaseAtiva] = useState<FaseFiscal['id']>('preparar')
  const [movimentos, setMovimentos] = useState<MovimentoFiscal[]>([])
  const [carregando, setCarregando] = useState(false)
  const [ultimoRefresh, setUltimoRefresh] = useState<string | null>(null)

  useEffect(() => {
    if (!tenant?.id) return
    let cancelado = false
    empresasService
      .list(tenant.id)
      .then((lista) => {
        if (!cancelado) setEmpresas(lista)
      })
      .catch(() => {
        if (!cancelado) setEmpresas([])
      })
    return () => {
      cancelado = true
    }
  }, [tenant?.id])

  const empresa = empresas.find((e) => e.id === empresaId) || null

  const carregarMovimentos = useCallback(async () => {
    if (!tenant?.id || !empresa) {
      setMovimentos([])
      return
    }
    setCarregando(true)
    try {
      const lista = await listarMovimentos({
        tenantId: tenant.id,
        empresaId: empresa.id,
        competencia,
      })
      setMovimentos(lista)
    } catch {
      setMovimentos([])
    } finally {
      setCarregando(false)
    }
  }, [tenant?.id, empresa, competencia])

  useEffect(() => {
    carregarMovimentos()
  }, [carregarMovimentos])

  const aoImportar = useCallback(() => {
    setUltimoRefresh(new Date().toISOString())
    carregarMovimentos()
  }, [carregarMovimentos])

  const aoExcluir = useCallback(
    async (_id: string) => {
      await carregarMovimentos()
    },
    [carregarMovimentos],
  )

  const fase = FASES_FISCAL.find((f) => f.id === faseAtiva) || FASES_FISCAL[0]

  const competenciaLabel = useMemo(() => {
    const [ano, mes] = competencia.split('-')
    if (!mes || !ano) return competencia
    return `${MESES_EXTENSO[Number(mes) - 1] || mes}/${ano}`
  }, [competencia])

  if (!fase) return null

  return (
    <div className="space-y-5 animate-fade-in pb-10">
      {/* Zona 1: Cabeçalho com seleção de Empresa + Competência */}
      <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="empresa-fiscal" className="text-[11px] font-semibold text-[#64748B]">
              Empresa
            </label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger
                id="empresa-fiscal"
                className="h-9 text-xs"
                aria-label="Selecionar empresa"
              >
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma empresa selecionada</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome_fantasia || e.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-52 space-y-1.5">
            <label
              htmlFor="competencia-fiscal"
              className="text-[11px] font-semibold text-[#64748B]"
            >
              Competência
            </label>
            <Input
              id="competencia-fiscal"
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <h2 className="text-lg font-bold text-[#1A2333]">Fiscal</h2>
          <Badge
            variant="outline"
            className="text-[10px] font-bold bg-[#0FA3A3]/10 text-[#0FA3A3] border-[#0FA3A3]/30"
          >
            Módulo Fiscal
          </Badge>
          {empresa && (
            <Badge
              variant="outline"
              className="text-[10px] font-bold bg-slate-50 text-slate-600 border-slate-200"
            >
              <Building2 className="h-3 w-3 mr-1" />
              {empresa.nome_fantasia || empresa.razao_social}
            </Badge>
          )}
          <Badge
            variant="outline"
            className="text-[10px] font-bold bg-slate-50 text-slate-600 border-slate-200"
          >
            <CalendarDays className="h-3 w-3 mr-1" />
            {competenciaLabel}
          </Badge>
        </div>
        <p className="text-xs text-[#64748B] mt-1">
          Apuração fiscal por empresa e competência — importação de XMLs, movimentações, apuração
          por regime e relatórios. O SPED &amp; Escrituração existente continua em{' '}
          <strong>Fiscal (legado)</strong>.
        </p>
      </Card>

      {/* Zona 2 + 3: sidebar de fases + área central */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
        <nav aria-label="Fases do módulo Fiscal" className="space-y-1">
          {FASES_FISCAL.map((f) => {
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

          {faseAtiva === 'preparar' && (
            <PrepararFase
              tenantId={tenant?.id}
              empresa={empresa}
              competencia={competencia}
              movimentos={movimentos}
              aoImportar={aoImportar}
            />
          )}

          {faseAtiva === 'movimentacoes' && (
            <MovimentacoesFase
              movimentos={movimentos}
              carregando={carregando}
              podeExcluir={!carregando && movimentos.length > 0}
              aoExcluir={aoExcluir}
            />
          )}

          {faseAtiva === 'obrigacoes' && (
            <ObrigacoesFase
              tenantId={tenant?.id}
              empresa={empresa}
              competencia={competencia}
              movimentos={movimentos}
            />
          )}

          {faseAtiva === 'relatorios' && (
            <RelatoriosFase tenantId={tenant?.id} empresa={empresa} competencia={competencia} />
          )}
        </div>
      </div>
    </div>
  )
}

// Reexportados para padronizar import nas páginas Makro (ícones usados no cabeçalho)
export { Building2, Users }

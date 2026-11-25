import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Users,
  CalendarDays,
  ClipboardList,
  FileText,
  BarChart3,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import type { Empresa } from '@/types'
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

export interface FaseMakro {
  id: string
  label: string
  icone: React.ComponentType<{ className?: string }>
  descricao: string
  acoes: string[]
}

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

interface ZonaModuloProps {
  titulo: string
  subtitulo: string
  nomeModulo: string
  descricaoFatia: string
  fases: FaseMakro[]
}

/**
 * Placeholder do módulo no modelo Makro (Fatia 1).
 * Segue as 3 zonas do PDF: cabeçalho (empresa + competência), sidebar
 * secundária em fases e área central de grades — com estado vazio
 * explicativo já que os módulos completos vêm nas fatias seguintes.
 */
export default function MakroZonaModuloPlaceholder({
  titulo,
  subtitulo,
  nomeModulo,
  descricaoFatia,
  fases,
}: ZonaModuloProps) {
  const { tenant } = useAuth()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState<string>('none')
  const [competencia, setCompetencia] = useState<string>('2026-02')
  const [faseAtiva, setFaseAtiva] = useState<string>(fases[0]?.id || 'preparar')

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

  const fase = fases.find((f) => f.id === faseAtiva) || fases[0]
  const empresaSelecionada = empresas.find((e) => e.id === empresaId)

  const competenciaLabel = useMemo(() => {
    const [mes, ano] = competencia.split('-')
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
            <label htmlFor="empresa-modulo" className="text-[11px] font-semibold text-[#64748B]">
              Empresa
            </label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger
                id="empresa-modulo"
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
              htmlFor="competencia-modulo"
              className="text-[11px] font-semibold text-[#64748B]"
            >
              Competência
            </label>
            <Input
              id="competencia-modulo"
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <h2 className="text-lg font-bold text-[#1A2333]">{titulo}</h2>
          <Badge
            variant="outline"
            className="text-[10px] font-bold bg-[#0FA3A3]/10 text-[#0FA3A3] border-[#0FA3A3]/30"
          >
            {nomeModulo}
          </Badge>
          {empresaSelecionada && (
            <Badge
              variant="outline"
              className="text-[10px] font-bold bg-slate-50 text-slate-600 border-slate-200"
            >
              <Building2 className="h-3 w-3 mr-1" />
              {empresaSelecionada.nome_fantasia || empresaSelecionada.razao_social}
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
        <p className="text-xs text-[#64748B] mt-1">{subtitulo}</p>
      </Card>

      {/* Zona 2 + 3: sidebar secundária em fases + área central */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
        {/* Sidebar secundária de fases */}
        <nav aria-label={`Fases do módulo ${titulo}`} className="space-y-1">
          {fases.map((f) => {
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
                <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-60" />
              </button>
            )
          })}
        </nav>

        {/* Área central de grades */}
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
            <div className="flex flex-wrap gap-2 mt-3">
              {fase.acoes.map((a) => (
                <Badge
                  key={a}
                  variant="outline"
                  className="text-[10px] font-semibold bg-slate-50 text-slate-600 border-slate-200"
                >
                  {a}
                </Badge>
              ))}
            </div>
          </Card>

          {/* Estado vazio explicativo (Fatia 1 — módulos completos vêm depois) */}
          <Card className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <Info className="h-10 w-10 text-slate-400 mx-auto mb-2" />
            <h4 className="font-bold text-slate-800 text-sm">
              {empresaSelecionada
                ? `Grades de ${fase.label} — ${empresaSelecionada.nome_fantasia || empresaSelecionada.razao_social}`
                : `Grades de ${fase.label}`}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-1">
              {competenciaLabel}
              {empresaSelecionada
                ? ` · ${empresaSelecionada.nome_fantasia || empresaSelecionada.razao_social}`
                : ''}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">{descricaoFatia}</p>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** Fases padrão do módulo Pessoal (preparar/movimentações/obrigações/relatórios). */
export const FASES_PESSOAL: FaseMakro[] = [
  {
    id: 'preparar',
    label: 'Preparar',
    icone: ClipboardList,
    descricao:
      'Admissões, documentos do colaborador, férias programadas e dados cadastrais prontos para o fechamento.',
    acoes: [
      'Admissões do período',
      'Checklist de documentos',
      'Férias programadas',
      'Alterações cadastrais',
    ],
  },
  {
    id: 'movimentacoes',
    label: 'Movimentações',
    icone: Layers,
    descricao:
      'Folha de pagamento, eventos eSocial, alterações contratuais e demais movimentações do mês da empresa selecionada.',
    acoes: ['Folha de pagamento', 'Eventos eSocial', 'Rescisões', 'Afastamentos'],
  },
  {
    id: 'obrigacoes',
    label: 'Obrigações',
    icone: FileText,
    descricao:
      'Declarações e guias do Pessoal: eSocial periódico, DCTFWeb/FGTS, CAGED e comprovantes de rendimentos.',
    acoes: ['eSocial (S-1200/S-1210)', 'DCTFWeb e FGTS', 'CAGED', 'Comprovantes de rendimento'],
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    icone: BarChart3,
    descricao:
      'Relatórios gerenciais do departamento pessoal: encargos, provisões, headcount e análise de folha por centro de custo.',
    acoes: ['Relatório de encargos', 'Provisões', 'Headcount', 'Folha por centro de custo'],
  },
]

/** Fases padrão do módulo Financeiro (conciliar/pagar/receber/relatórios). */
export const FASES_FINANCEIRO: FaseMakro[] = [
  {
    id: 'preparar',
    label: 'Preparar',
    icone: ClipboardList,
    descricao:
      'Conciliação bancária, importação de extratos, classificação de lançamentos e cadastros financeiros do período.',
    acoes: [
      'Conciliação bancária',
      'Importar extratos',
      'Classificar lançamentos',
      'Centros de custo',
    ],
  },
  {
    id: 'movimentacoes',
    label: 'Movimentações',
    icone: Layers,
    descricao:
      'Contas a pagar e a receber, cobranças, conciliação de carteiras e fluxo de caixa do mês da empresa selecionada.',
    acoes: ['Contas a pagar', 'Contas a receber', 'Cobranças', 'Fluxo de caixa'],
  },
  {
    id: 'obrigacoes',
    label: 'Obrigações',
    icone: FileText,
    descricao:
      'Guias de impostos e encargos, Impostos Retidos e obrigações acessórias ligadas ao Financeiro.',
    acoes: ['Guias de impostos', 'Impostos retidos', 'Obrigações acessórias', 'Fechamento mensal'],
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    icone: BarChart3,
    descricao:
      'DRE, balancete, análise de resultado e relatórios gerenciais por empresa e competência.',
    acoes: ['DRE gerencial', 'Balancete', 'Análise de resultado', 'Relatórios por centro de custo'],
  },
]

export { Building2, Users } // re-exportados para uso nas páginas de módulo

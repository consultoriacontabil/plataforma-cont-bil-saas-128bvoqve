import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, RotateCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { agendaTributariaService } from '@/services/agendaTributaria'
import { empresasService } from '@/services/empresas'
import type { AgendaTributaria, Empresa, EmpresaRegime } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const PERFIS: { value: EmpresaRegime | 'todas'; label: string }[] = [
  { value: 'todas', label: 'Todos os perfis' },
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
  { value: 'mei', label: 'MEI' },
]

const LABEL_PERFIL: Record<string, string> = {
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
  mei: 'MEI',
  todas: 'Todas',
}

const LABEL_DEPTO: Record<string, string> = {
  Pessoal: 'Pessoal',
  Fiscal: 'Fiscal',
  Contábil: 'Contábil',
  Administrar: 'Administrar',
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function formatarVencimentoDia(dia?: number) {
  return dia ? `dia ${dia}` : '—'
}

export default function AgendaTributariaPage() {
  const { tenant } = useAuth()
  const { toast } = useToast()

  const [itens, setItens] = useState<AgendaTributaria[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroPerfil, setFiltroPerfil] = useState<string>('todas')
  const [filtroDepto, setFiltroDepto] = useState<string>('todos')
  const [competencia, setCompetencia] = useState<string>('2026-02')

  const carregar = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const [lista, emps] = await Promise.all([
        agendaTributariaService.list(tenant.id),
        empresasService.list(tenant.id).catch(() => [] as Empresa[]),
      ])
      setItens(lista)
      setEmpresas(emps)
    } catch (err) {
      console.error('Erro ao carregar agenda tributária:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar a agenda tributária.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  const perfisComEmpresas = useMemo(() => {
    const s = new Set<string>()
    empresas.forEach((e) => {
      if (e.regime_tributario) s.add(e.regime_tributario)
    })
    return s
  }, [empresas])

  const filtradas = useMemo(() => {
    return itens
      .filter((i) => (filtroPerfil === 'todas' ? true : i.perfil === filtroPerfil))
      .filter((i) => (filtroDepto === 'todos' ? true : i.departamento === filtroDepto))
      .sort((a, b) => {
        if (a.departamento !== b.departamento) return a.departamento.localeCompare(b.departamento)
        return (a.vencimento_dia ?? 99) - (b.vencimento_dia ?? 99)
      })
  }, [itens, filtroPerfil, filtroDepto])

  const agrupadas = useMemo(() => {
    const map = new Map<string, AgendaTributaria[]>()
    filtradas.forEach((i) => {
      const chave = i.departamento || 'Outros'
      if (!map.has(chave)) map.set(chave, [])
      map.get(chave)!.push(i)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtradas])

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1A2333] flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-[#0FA3A3]" />
            Agenda Tributária
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Grade de obrigações legais por perfil de empresa (Simples Nacional, Presumido, Lucro
            Real, MEI), com vencimento típico e periodicidade.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={carregar}
          disabled={loading}
          className="h-9 text-xs gap-1.5"
        >
          <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card className="rounded-2xl border-[#E2E8F0] p-4 shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <label className="text-[11px] font-semibold text-[#64748B]">Perfil da empresa</label>
            <Select value={filtroPerfil} onValueChange={setFiltroPerfil}>
              <SelectTrigger className="h-9 text-xs" aria-label="Filtrar por perfil">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERFIS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                    {p.value !== 'todas' && !perfisComEmpresas.has(p.value) && (
                      <span className="text-[10px] text-slate-400 ml-1">(sem empresas)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-[11px] font-semibold text-[#64748B]">Departamento</label>
            <Select value={filtroDepto} onValueChange={setFiltroDepto}>
              <SelectTrigger className="h-9 text-xs" aria-label="Filtrar por departamento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Pessoal">Pessoal</SelectItem>
                <SelectItem value="Fiscal">Fiscal</SelectItem>
                <SelectItem value="Contábil">Contábil</SelectItem>
                <SelectItem value="Administrar">Administrar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-[11px] font-semibold text-[#64748B]">Competência</label>
            <Input
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="h-9 text-xs"
              aria-label="Competência de referência"
            />
          </div>
        </div>
        <p className="text-[11px] text-[#94A3B8] mt-3">
          Mostrando {filtradas.length} obrigação(ões){' '}
          {filtroPerfil !== 'todas' && `do perfil ${LABEL_PERFIL[filtroPerfil] || filtroPerfil}`}
          {filtroDepto !== 'todos' && ` do departamento ${LABEL_DEPTO[filtroDepto] || filtroDepto}`}
          {competencia && ` na competência ${competencia.split('-').reverse().join('/')}`}
        </p>
      </Card>

      {/* Grade por departamento */}
      {loading ? (
        <Card className="rounded-2xl border-dashed p-8 text-center text-sm text-[#94A3B8]">
          Carregando agenda...
        </Card>
      ) : agrupadas.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-slate-300 p-10 text-center bg-slate-50">
          <CalendarClock className="h-10 w-10 text-slate-400 mx-auto mb-2" />
          <h4 className="font-bold text-slate-800 text-sm">Nenhuma obrigação para este filtro</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Ajuste o perfil ou o departamento selecionado. O catálogo da agenda é semeado
            automaticamente por tenant na migration 0161.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {agrupadas.map(([depto, lista]) => (
            <Card key={depto} className="rounded-2xl border-[#E2E8F0] shadow-2xs overflow-hidden">
              <CardHeader className="pb-2 pt-4 px-4 bg-slate-50/60 border-b border-[#E2E8F0]">
                <CardTitle className="text-sm font-bold text-[#1A2333]">
                  {depto}
                  <span className="ml-2 text-[11px] font-normal text-[#64748B]">
                    {lista.length} obrigação(ões)
                  </span>
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Vencimentos típicos por competência — o status individual de cada entrega é
                  acompanhado nas Obrigações.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-left text-[10px] uppercase tracking-wide text-[#94A3B8]">
                        <th className="px-4 py-2 font-semibold">Obrigação</th>
                        <th className="px-4 py-2 font-semibold">Perfil</th>
                        <th className="px-4 py-2 font-semibold">Vencimento</th>
                        <th className="px-4 py-2 font-semibold">Periodicidade</th>
                        <th className="px-4 py-2 font-semibold">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((i) => (
                        <tr
                          key={i.id}
                          className="border-b border-[#F1F5F9] last:border-0 hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="px-4 py-2.5 font-medium text-[#1A2333]">{i.obrigacao}</td>
                          <td className="px-4 py-2.5">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold bg-slate-50 text-slate-600 border-slate-200"
                            >
                              {LABEL_PERFIL[i.perfil] || i.perfil}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-[#1A2333]">
                            {formatarVencimentoDia(i.vencimento_dia)}
                          </td>
                          <td className="px-4 py-2.5 capitalize text-[#64748B]">
                            {i.periodicidade}
                          </td>
                          <td className="px-4 py-2.5 text-[#64748B]">{i.observacao || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Legenda */}
      <p className="text-[11px] text-[#94A3B8]">
        Perfis disponíveis:{' '}
        {PERFIS.filter((p) => p.value !== 'todas')
          .map((p) => p.label)
          .join(', ')}
        . O vencimento em "dia N" refere-se ao Nº dia do mês seguinte à competência
        {competencia
          ? ` (base ${MESES[Number(competencia.split('-')[0]) - 1] ? MESES[Number(competencia.split('-')[0]) - 1] : ''})`
          : ''}
        .
      </p>
    </div>
  )
}

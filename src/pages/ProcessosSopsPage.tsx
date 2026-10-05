import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ListTodo,
  Bot,
  PlayCircle,
  PlusCircle,
  Building2,
  Calendar,
  Layers,
  Search,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  elisaOpsService,
  type SopRecord,
  type ProcessoOperacionalRecord,
  type AreaOperacional,
} from '@/services/elisaOpsService'
import { empresasService } from '@/services/empresas'
import { useRealtime } from '@/hooks/use-realtime'
import type { Empresa } from '@/types'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { maskCnpj, formatDatePtBr } from '@/lib/formatters'

export default function ProcessosSopsPage() {
  const { tenant } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [sops, setSops] = useState<SopRecord[]>([])
  const [processos, setProcessos] = useState<ProcessoOperacionalRecord[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [areaFiltro, setAreaFiltro] = useState<string>('todas')
  const [buscaTexto, setBuscaTexto] = useState<string>('')

  // Modal Novo Processo a partir de SOP
  const [modalNovoProcessoAberta, setModalNovoProcessoAberta] = useState(false)
  const [sopSelecionado, setSopSelecionado] = useState<SopRecord | null>(null)
  const [empresaIdSelecionada, setEmpresaIdSelecionada] = useState<string>('')
  const [competenciaInput, setCompetenciaInput] = useState<string>('09/2026')
  const [criandoProcesso, setCriandoProcesso] = useState(false)

  const loadData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const [sopsRes, procRes, empRes] = await Promise.all([
        elisaOpsService.listSops(tenant.id, areaFiltro),
        elisaOpsService.listProcessos(tenant.id),
        empresasService.list(tenant.id),
      ])
      setSops(sopsRes)
      setProcessos(procRes)
      setEmpresas(empRes)
      if (empRes.length > 0 && !empresaIdSelecionada) {
        setEmpresaIdSelecionada(empRes[0].id)
      }
    } catch (err) {
      console.error('Erro ao carregar SOPs e Processos:', err)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao sincronizar catálogo de SOPs.',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, areaFiltro, empresaIdSelecionada, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('sops', () => loadData())
  useRealtime('processos_operacionais', () => loadData())

  // Criar Instância de Processo a partir de SOP
  const handleCriarProcesso = async () => {
    if (!tenant?.id || !sopSelecionado || !empresaIdSelecionada) {
      toast({
        variant: 'destructive',
        title: 'Dados Incompletos',
        description: 'Selecione a empresa e o SOP desejado.',
      })
      return
    }

    setCriandoProcesso(true)
    try {
      const res = await elisaOpsService.createProcessoFromSop({
        tenantId: tenant.id,
        empresaId: empresaIdSelecionada,
        sop: sopSelecionado,
        competencia: competenciaInput,
        prioridade: 'alta',
      })

      toast({
        title: 'Processo Instanciado com Sucesso!',
        description: `${res.processo.titulo} enfileirado na Fila da ELISA com ${res.etapas.length} etapas.`,
      })
      setModalNovoProcessoAberta(false)
      loadData()
      navigate(`/processos/${res.processo.id}`)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao instanciar processo',
        description: String(err),
      })
    } finally {
      setCriandoProcesso(false)
    }
  }

  const sopsFiltrados = useMemo(() => {
    if (!buscaTexto.trim()) return sops
    const t = buscaTexto.toLowerCase()
    return sops.filter(
      (s) =>
        s.codigo.toLowerCase().includes(t) ||
        s.nome.toLowerCase().includes(t) ||
        (s.objetivo && s.objetivo.toLowerCase().includes(t)),
    )
  }, [sops, buscaTexto])

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-[#0FA3A3] text-white text-xs font-bold">
              POP → SOP EXECUTÁVEL
            </Badge>
            <Badge variant="outline" className="text-slate-600 text-xs">
              Biblioteca de Procedimentos Operacionais Padrão
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Processos e SOPs Executáveis
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cada POP oficial (/pop-treinamento) possui um SOP Executável estruturado em etapas,
            entradas, ações, critérios e autonomia.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/elisa-fila">
            <Button
              size="sm"
              className="h-9 text-xs bg-[#0FA3A3] hover:bg-[#0c8282] text-white gap-1.5 font-semibold"
            >
              <Bot className="h-4 w-4" />
              <span>Ver Fila da ELISA</span>
            </Button>
          </Link>
          <Link to="/pop-treinamento">
            <Button variant="outline" size="sm" className="h-9 text-xs border-slate-300">
              POPs Oficiais (POP-ELLIZA-2026.3)
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="sops" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger value="sops" className="text-xs font-semibold gap-2">
            <ListTodo className="h-4 w-4 text-[#0FA3A3]" />
            <span>Biblioteca de SOPs ({sops.length})</span>
          </TabsTrigger>
          <TabsTrigger value="processos" className="text-xs font-semibold gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            <span>Processos Instanciados ({processos.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: BIBLIOTECA DE SOPS */}
        <TabsContent value="sops" className="space-y-4">
          <Card className="rounded-2xl border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar SOP por código, nome ou objetivo..."
                  value={buscaTexto}
                  onChange={(e) => setBuscaTexto(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div className="w-full sm:w-48">
                <Select value={areaFiltro} onValueChange={setAreaFiltro}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Filtrar por Área" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Áreas</SelectItem>
                    <SelectItem value="contabil">Contábil</SelectItem>
                    <SelectItem value="fiscal">Fiscal</SelectItem>
                    <SelectItem value="pessoal">Pessoal (DP)</SelectItem>
                    <SelectItem value="societario">Societário</SelectItem>
                    <SelectItem value="geral">Geral / Atendimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sopsFiltrados.map((sop) => {
              const etapasCount = sop.etapas_template_json?.length || 0

              return (
                <Card
                  key={sop.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge className="bg-teal-50 text-[#0FA3A3] border border-teal-200 text-[11px] font-bold">
                        {sop.codigo} • {sop.area.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-slate-500">
                        v{sop.versao}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm leading-snug">
                        {sop.nome}
                      </h3>
                      {sop.objetivo && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                          {sop.objetivo}
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-700">
                        <span>Checklist Padronizado:</span>
                        <strong className="text-teal-700">{etapasCount} Etapas</strong>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-700">
                        <span>Nível de Autonomia:</span>
                        <span className="font-semibold text-slate-800">
                          {sop.nivel_autonomia.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400">
                      Agente:{' '}
                      <strong className="text-slate-700">{sop.agente_nome || 'ELISA'}</strong>
                    </span>

                    <Button
                      size="sm"
                      onClick={() => {
                        setSopSelecionado(sop)
                        setModalNovoProcessoAberta(true)
                      }}
                      className="bg-[#0FA3A3] hover:bg-[#0c8282] text-white text-xs h-8 gap-1 font-semibold"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      <span>Instanciar</span>
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* ABA 2: PROCESSOS INSTANCIADOS */}
        <TabsContent value="processos" className="space-y-4">
          <Card className="rounded-2xl border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-3">Processo</th>
                    <th className="py-3.5 px-3">Cliente</th>
                    <th className="py-3.5 px-3">Competência</th>
                    <th className="py-3.5 px-3">Etapa Atual</th>
                    <th className="py-3.5 px-3">Progresso</th>
                    <th className="py-3.5 px-3">Status</th>
                    <th className="py-3.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {processos.map((proc) => {
                    const empNome =
                      proc.expand?.empresa_id?.nome_fantasia ||
                      proc.expand?.empresa_id?.razao_social ||
                      'Empresa'

                    return (
                      <tr key={proc.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 block">{proc.titulo}</span>
                          <span className="text-[10px] text-slate-500">
                            {proc.codigo_sop} • {proc.area}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800">{empNome}</span>
                        </td>

                        <td className="py-3 px-3">
                          <Badge variant="outline" className="text-xs font-semibold">
                            {proc.competencia}
                          </Badge>
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-medium text-slate-800 block">
                            {proc.etapa_atual_nome || '—'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Etapa {proc.etapa_atual_numero} de {proc.total_etapas}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-bold text-[#0FA3A3]">
                            {proc.progresso_percentual || 0}%
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <Badge
                            className={
                              proc.status === 'CONCLUIDO'
                                ? 'bg-emerald-600 text-white text-[10px]'
                                : 'bg-[#0FA3A3] text-white text-[10px]'
                            }
                          >
                            {proc.status.replace('_', ' ')}
                          </Badge>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <Link to={`/processos/${proc.id}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-slate-300"
                            >
                              Executar / Ver
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL INSTANCIAR NOVO PROCESSO OPERACIONAL */}
      <Dialog open={modalNovoProcessoAberta} onOpenChange={setModalNovoProcessoAberta}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <PlayCircle className="h-5 w-5 text-[#0FA3A3]" />
              <span>Instanciar Processo: {sopSelecionado?.codigo}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {sopSelecionado?.nome}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Selecione o Cliente / Empresa:
              </label>
              <Select value={empresaIdSelecionada} onValueChange={setEmpresaIdSelecionada}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                Competência Contábil (MM/AAAA):
              </label>
              <Input
                value={competenciaInput}
                onChange={(e) => setCompetenciaInput(e.target.value)}
                placeholder="Ex.: 09/2026"
                className="h-9 text-xs"
              />
            </div>

            <div className="rounded-xl bg-teal-50 border border-teal-200 p-3 text-xs text-teal-900 leading-relaxed">
              <strong>Automação ELISA:</strong> Ao confirmar, a Rumo criará o processo, gerará as
              etapas no checklist e colocará o primeiro Job na Fila da ELISA ordenado por
              prioridade.
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalNovoProcessoAberta(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCriarProcesso}
              disabled={criandoProcesso}
              className="bg-[#0FA3A3] hover:bg-[#0c8282] text-white text-xs font-bold"
            >
              {criandoProcesso ? 'Instanciando...' : 'Iniciar Processo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

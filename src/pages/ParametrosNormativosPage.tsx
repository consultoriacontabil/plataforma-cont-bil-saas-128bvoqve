import React, { useState, useEffect } from 'react'
import {
  SlidersHorizontal,
  Save,
  RotateCcw,
  ShieldCheck,
  Calendar,
  Layers,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  calculoUnificadoService,
  PARAMETROS_INSS_PADRAO,
  PARAMETROS_IRRF_PADRAO,
  PARAMETROS_FGTS_PADRAO,
  PARAMETROS_SIMPLES_PADRAO,
  PARAMETROS_ISS_PADRAO,
  PARAMETROS_LUCRO_PRESUMIDO_PADRAO,
  type ParametroNormativoRecord,
  type ParametroCategoria,
} from '@/services/calculoUnificado'

export default function ParametrosNormativosPage() {
  const { tenant, user, member } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [parametrosDb, setParametrosDb] = useState<ParametroNormativoRecord[]>([])
  const [activeTab, setActiveTab] = useState<ParametroCategoria>('inss')

  // Estados locais para edição dos parâmetros
  const [inssState, setInssState] = useState(PARAMETROS_INSS_PADRAO)
  const [irrfState, setIrrfState] = useState(PARAMETROS_IRRF_PADRAO)
  const [fgtsState, setFgtsState] = useState(PARAMETROS_FGTS_PADRAO)
  const [simplesState, setSimplesState] = useState(PARAMETROS_SIMPLES_PADRAO)
  const [issState, setIssState] = useState(PARAMETROS_ISS_PADRAO)
  const [lpState, setLpState] = useState(PARAMETROS_LUCRO_PRESUMIDO_PADRAO)

  const [vigenciaInicio, setVigenciaInicio] = useState('2026-01-01')

  // Carregar parâmetros salvos no banco
  useEffect(() => {
    async function load() {
      if (!tenant?.id) return
      setLoading(true)
      try {
        const list = await calculoUnificadoService.listarParametros(tenant.id)
        setParametrosDb(list)

        // Preencher estados com registros vigentes se existirem
        list.forEach((p) => {
          if (p.categoria === 'inss' && p.valores_json) {
            setInssState({ ...PARAMETROS_INSS_PADRAO, ...(p.valores_json as any) })
            if (p.vigencia_inicio) setVigenciaInicio(p.vigencia_inicio.slice(0, 10))
          }
          if (p.categoria === 'irrf' && p.valores_json) {
            setIrrfState({ ...PARAMETROS_IRRF_PADRAO, ...(p.valores_json as any) })
          }
          if (p.categoria === 'fgts' && p.valores_json) {
            setFgtsState({ ...PARAMETROS_FGTS_PADRAO, ...(p.valores_json as any) })
          }
          if (p.categoria === 'simples_nacional' && p.valores_json) {
            setSimplesState({ ...PARAMETROS_SIMPLES_PADRAO, ...(p.valores_json as any) })
          }
          if (p.categoria === 'iss' && p.valores_json) {
            setIssState({ ...PARAMETROS_ISS_PADRAO, ...(p.valores_json as any) })
          }
          if (p.categoria === 'lucro_presumido' && p.valores_json) {
            setLpState({ ...PARAMETROS_LUCRO_PRESUMIDO_PADRAO, ...(p.valores_json as any) })
          }
        })
      } catch (err) {
        console.error('Erro ao carregar parâmetros normativos:', err)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [tenant?.id])

  const handleSalvarCategoria = async (categoria: ParametroCategoria) => {
    if (!tenant?.id) return
    setSalvando(true)

    let valores: Record<string, unknown> = {}
    let titulo = ''
    let chave = ''

    if (categoria === 'inss') {
      valores = inssState as any
      titulo = 'Tabela Progressiva INSS'
      chave = 'inss_tabela_progressiva_2026'
    } else if (categoria === 'irrf') {
      valores = irrfState as any
      titulo = 'Tabela Progressiva IRRF'
      chave = 'irrf_tabela_progressiva_2026'
    } else if (categoria === 'fgts') {
      valores = fgtsState as any
      titulo = 'Alíquotas Normativas de FGTS'
      chave = 'fgts_aliquotas_2026'
    } else if (categoria === 'simples_nacional') {
      valores = simplesState as any
      titulo = 'Tabelas e Anexos Simples Nacional'
      chave = 'simples_nacional_anexos_2026'
    } else if (categoria === 'iss') {
      valores = issState as any
      titulo = 'Parâmetros Normativos de ISS'
      chave = 'iss_parametros_municipais_2026'
    } else if (categoria === 'lucro_presumido') {
      valores = lpState as any
      titulo = 'Bases e Alíquotas Lucro Presumido'
      chave = 'lucro_presumido_irpj_csll_2026'
    }

    try {
      // Verificar se já existe registro dessa categoria
      const existente = parametrosDb.find((p) => p.categoria === categoria)

      const rec = await calculoUnificadoService.salvarParametros({
        tenantId: tenant.id,
        id: existente?.id,
        categoria,
        chave,
        titulo,
        vigencia_inicio: `${vigenciaInicio} 00:00:00.000Z`,
        valores_json: valores,
        usuarioId: user?.id,
      })

      // Atualizar lista local
      setParametrosDb((prev) => {
        const outros = prev.filter((p) => p.id !== rec.id && p.categoria !== categoria)
        return [...outros, rec]
      })

      toast({
        title: 'Parâmetros normativos salvos!',
        description: `As alíquotas e limites de ${titulo} foram atualizados e propagados para todos os cálculos.`,
      })
    } catch (err: any) {
      console.error('Erro ao salvar parâmetros:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: err?.message || 'Falha ao persistir parâmetros normativos.',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto pb-16">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#1A2333] tracking-tight">
              Motor de Cálculo & Parâmetros Normativos
            </h1>
            <Badge className="bg-[#0FA3A3] text-white hover:bg-[#0C8585] text-xs font-semibold px-2.5 py-0.5 rounded-full">
              FASE 3
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Camada centralizada e versionada de alíquotas, faixas e limites tributários e
            trabalhistas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="text-xs font-semibold px-3 py-1 bg-white border-slate-200"
          >
            <Calendar className="h-3.5 w-3.5 mr-1.5 text-[#0FA3A3]" />
            Vigência Atual: {vigenciaInicio}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as ParametroCategoria)}>
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 h-auto p-1 bg-slate-100 rounded-xl mb-4">
          <TabsTrigger value="inss" className="text-xs rounded-lg py-2">
            INSS
          </TabsTrigger>
          <TabsTrigger value="irrf" className="text-xs rounded-lg py-2">
            IRRF
          </TabsTrigger>
          <TabsTrigger value="fgts" className="text-xs rounded-lg py-2">
            FGTS
          </TabsTrigger>
          <TabsTrigger value="simples_nacional" className="text-xs rounded-lg py-2">
            Simples Nacional
          </TabsTrigger>
          <TabsTrigger value="iss" className="text-xs rounded-lg py-2">
            ISS
          </TabsTrigger>
          <TabsTrigger value="lucro_presumido" className="text-xs rounded-lg py-2">
            Lucro Presumido
          </TabsTrigger>
        </TabsList>

        {/* ABA: INSS */}
        <TabsContent value="inss" className="space-y-4">
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#1A2333]">
                    Tabela Progressiva INSS e Encargos Patronais
                  </CardTitle>
                  <CardDescription className="text-xs text-[#64748B]">
                    Faixas salariais, alíquotas progressivas e teto de contribuição previdenciária.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => handleSalvarCategoria('inss')}
                  disabled={salvando}
                  className="bg-[#0FA3A3] text-white hover:bg-[#0C8585] rounded-xl text-xs h-9 gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>Salvar INSS</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Teto Salário Contribuição (R$)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={inssState.teto_salario_contribuicao}
                    onChange={(e) =>
                      setInssState({
                        ...inssState,
                        teto_salario_contribuicao: Number(e.target.value),
                      })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Teto Desconto Empregado (R$)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={inssState.teto_desconto}
                    onChange={(e) =>
                      setInssState({ ...inssState, teto_desconto: Number(e.target.value) })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    INSS Patronal Padrão (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={inssState.aliquota_patronal_padrao}
                    onChange={(e) =>
                      setInssState({
                        ...inssState,
                        aliquota_patronal_padrao: Number(e.target.value),
                      })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
              </div>

              {/* Faixas Progressivas */}
              <div className="space-y-2 pt-2">
                <p className="text-xs font-bold text-slate-800">Faixas Progressivas Empregado</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
                  {inssState.faixas.map((f, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-700">Faixa {idx + 1}</span>
                      <div className="flex items-center gap-4">
                        <span>Até R$ {f.ate.toFixed(2)}</span>
                        <span className="font-bold text-[#0FA3A3]">
                          {(f.aliquota * 100).toFixed(1)}%
                        </span>
                        <span className="text-slate-500">Dedução: R$ {f.deducao.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: IRRF */}
        <TabsContent value="irrf" className="space-y-4">
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#1A2333]">
                    Tabela Progressiva IRRF & Deduções
                  </CardTitle>
                  <CardDescription className="text-xs text-[#64748B]">
                    Faixas de rendimento, alíquotas, deduções por dependente e desconto
                    simplificado.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => handleSalvarCategoria('irrf')}
                  disabled={salvando}
                  className="bg-[#0FA3A3] text-white hover:bg-[#0C8585] rounded-xl text-xs h-9 gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>Salvar IRRF</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Dedução por Dependente (R$)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={irrfState.deducao_por_dependente}
                    onChange={(e) =>
                      setIrrfState({ ...irrfState, deducao_por_dependente: Number(e.target.value) })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Desconto Simplificado Mensal (R$)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={irrfState.desconto_simplificado_mensal}
                    onChange={(e) =>
                      setIrrfState({
                        ...irrfState,
                        desconto_simplificado_mensal: Number(e.target.value),
                      })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-xs font-bold text-slate-800">Faixas da Tabela Progressiva</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
                  {irrfState.faixas.map((f, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-700">Faixa {idx + 1}</span>
                      <div className="flex items-center gap-4">
                        <span>
                          {f.ate > 1000000 ? 'Acima do teto' : `Até R$ ${f.ate.toFixed(2)}`}
                        </span>
                        <span className="font-bold text-[#0FA3A3]">
                          {(f.aliquota * 100).toFixed(1)}%
                        </span>
                        <span className="text-slate-500">
                          Parcela a deduzir: R$ {f.deducao.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: FGTS */}
        <TabsContent value="fgts" className="space-y-4">
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#1A2333]">
                    Alíquotas Normativas de FGTS & Multa Rescisória
                  </CardTitle>
                  <CardDescription className="text-xs text-[#64748B]">
                    Percentuais legais aplicáveis para CLT, Aprendiz e Rescisão sem justa causa.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => handleSalvarCategoria('fgts')}
                  disabled={salvando}
                  className="bg-[#0FA3A3] text-white hover:bg-[#0C8585] rounded-xl text-xs h-9 gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>Salvar FGTS</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Alíquota Padrão CLT (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={fgtsState.aliquota_clt}
                    onChange={(e) =>
                      setFgtsState({ ...fgtsState, aliquota_clt: Number(e.target.value) })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Alíquota Aprendiz (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={fgtsState.aliquota_jovem_aprendiz}
                    onChange={(e) =>
                      setFgtsState({
                        ...fgtsState,
                        aliquota_jovem_aprendiz: Number(e.target.value),
                      })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Multa Rescisória CLT (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={fgtsState.multa_rescisoria_sem_justa_causa}
                    onChange={(e) =>
                      setFgtsState({
                        ...fgtsState,
                        multa_rescisoria_sem_justa_causa: Number(e.target.value),
                      })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: SIMPLES NACIONAL */}
        <TabsContent value="simples_nacional" className="space-y-4">
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#1A2333]">
                    Parâmetros Simples Nacional (LC 123/2006)
                  </CardTitle>
                  <CardDescription className="text-xs text-[#64748B]">
                    Limites de receita bruta, sublimite estadual e anexos tarifários.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => handleSalvarCategoria('simples_nacional')}
                  disabled={salvando}
                  className="bg-[#0FA3A3] text-white hover:bg-[#0C8585] rounded-xl text-xs h-9 gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>Salvar Simples</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Sublimite Estadual ICMS/ISS (R$)
                  </label>
                  <Input
                    type="number"
                    step="1000"
                    value={simplesState.sublimite_estadual}
                    onChange={(e) =>
                      setSimplesState({
                        ...simplesState,
                        sublimite_estadual: Number(e.target.value),
                      })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Limite Geral RBT12 (R$)
                  </label>
                  <Input
                    type="number"
                    step="1000"
                    value={simplesState.limite_geral}
                    onChange={(e) =>
                      setSimplesState({ ...simplesState, limite_geral: Number(e.target.value) })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: ISS */}
        <TabsContent value="iss" className="space-y-4">
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#1A2333]">
                    Parâmetros Constitucionais e Municipais de ISS
                  </CardTitle>
                  <CardDescription className="text-xs text-[#64748B]">
                    Limites constitucionais (2% a 5%) e alíquota padrão para prestadores de
                    serviços.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => handleSalvarCategoria('iss')}
                  disabled={salvando}
                  className="bg-[#0FA3A3] text-white hover:bg-[#0C8585] rounded-xl text-xs h-9 gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>Salvar ISS</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Alíquota Mínima Legal (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={issState.aliquota_minima}
                    onChange={(e) =>
                      setIssState({ ...issState, aliquota_minima: Number(e.target.value) })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Alíquota Máxima Legal (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={issState.aliquota_maxima}
                    onChange={(e) =>
                      setIssState({ ...issState, aliquota_maxima: Number(e.target.value) })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Alíquota Padrão (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={issState.aliquota_padrao}
                    onChange={(e) =>
                      setIssState({ ...issState, aliquota_padrao: Number(e.target.value) })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: LUCRO PRESUMIDO */}
        <TabsContent value="lucro_presumido" className="space-y-4">
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-[#1A2333]">
                    Bases e Presunções do Lucro Presumido
                  </CardTitle>
                  <CardDescription className="text-xs text-[#64748B]">
                    Alíquotas de IRPJ, CSLL, PIS e COFINS cumulativo com adicional trimestral.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => handleSalvarCategoria('lucro_presumido')}
                  disabled={salvando}
                  className="bg-[#0FA3A3] text-white hover:bg-[#0C8585] rounded-xl text-xs h-9 gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  <span>Salvar Lucro Presumido</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Presunção IRPJ Serviços (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={lpState.presuncao_irpj_servicos}
                    onChange={(e) =>
                      setLpState({ ...lpState, presuncao_irpj_servicos: Number(e.target.value) })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Presunção CSLL Serviços (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={lpState.presuncao_csll_servicos}
                    onChange={(e) =>
                      setLpState({ ...lpState, presuncao_csll_servicos: Number(e.target.value) })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Alíquota IRPJ (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={lpState.aliquota_irpj}
                    onChange={(e) =>
                      setLpState({ ...lpState, aliquota_irpj: Number(e.target.value) })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Alíquota CSLL (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={lpState.aliquota_csll}
                    onChange={(e) =>
                      setLpState({ ...lpState, aliquota_csll: Number(e.target.value) })
                    }
                    className="h-9 text-xs rounded-xl font-bold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

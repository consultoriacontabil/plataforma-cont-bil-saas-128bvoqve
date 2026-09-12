import { useState, useEffect } from 'react'
import {
  Scale,
  Bell,
  AlertTriangle,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Plus,
  CheckCircle2,
  Archive,
  ExternalLink,
  Calculator,
  ShieldAlert,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Code2,
  Upload,
  Info,
  Check,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { monitoramentoLegislativoService } from '@/services/monitoramentoLegislativo'
import { auditService } from '@/services/audit'
import { notificacoesService } from '@/services/notificacoes'
import type {
  PublicacaoLegislativaRecord,
  PublicacaoFonte,
  PublicacaoClassificacao,
  PublicacaoCriticidade,
  PublicacaoStatus,
  ImpactoCalculadoJson,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'

export function MonitoramentoLegislativoPage() {
  const { tenant, user } = useAuth()
  const { toast } = useToast()

  const [publicacoes, setPublicacoes] = useState<PublicacaoLegislativaRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [filtroFonte, setFiltroFonte] = useState<string>('todos')
  const [filtroClassificacao, setFiltroClassificacao] = useState<string>('todos')
  const [filtroCriticidade, setFiltroCriticidade] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [termoBusca, setTermoBusca] = useState<string>('')

  // Detalhe / Análise
  const [pubSelecionada, setPubSelecionada] = useState<PublicacaoLegislativaRecord | null>(null)
  const [notasAnalise, setNotasAnalise] = useState<string>('')
  const [analisando, setAnalisando] = useState(false)

  // Modal Novo Cadastro Manual
  const [modalNovoAberto, setModalNovoAberto] = useState(false)
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novoNorma, setNovoNorma] = useState('')
  const [novoFonte, setNovoFonte] = useState<PublicacaoFonte>('dou')
  const [novoDataPub, setNovoDataPub] = useState(new Date().toISOString().slice(0, 10))
  const [novoClassificacao, setNovoClassificacao] = useState<PublicacaoClassificacao>('aliquota')
  const [novoCriticidade, setNovoCriticidade] = useState<PublicacaoCriticidade>('alta')
  const [novoResumo, setNovoResumo] = useState('')
  const [novoLink, setNovoLink] = useState('')
  const [novoTributo, setNovoTributo] = useState('')
  const [novoAliqAnt, setNovoAliqAnt] = useState<string>('')
  const [novoAliqNova, setNovoAliqNova] = useState<string>('')
  const [salvandoPub, setSalvandoPub] = useState(false)

  // Modal Importação Texto / JSON
  const [modalImportAberto, setModalImportAberto] = useState(false)
  const [textoColado, setTextoColado] = useState('')
  const [importando, setImportando] = useState(false)

  // Comparador de Alíquotas Avulso (Simulador Instantâneo)
  const [compTributo, setCompTributo] = useState('CBS / IBS')
  const [compAliqAnt, setCompAliqAnt] = useState<number>(0.65)
  const [compAliqNova, setCompAliqNova] = useState<number>(0.9)
  const [compResultado, setCompResultado] = useState<ImpactoCalculadoJson | null>(null)
  const [calculandoComp, setCalculandoComp] = useState(false)
  const [notificandoImpacto, setNotificandoImpacto] = useState(false)

  // Permissões
  const podeEditar = user?.perfil === 'administrador' || user?.perfil === 'contador'

  const carregarPublicacoes = async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const filters: string[] = []
      if (filtroFonte !== 'todos') filters.push(`fonte = "${filtroFonte}"`)
      if (filtroClassificacao !== 'todos') filters.push(`classificacao = "${filtroClassificacao}"`)
      if (filtroCriticidade !== 'todos') filters.push(`criticidade = "${filtroCriticidade}"`)
      if (filtroStatus !== 'todos') filters.push(`status = "${filtroStatus}"`)
      const filterStr = filters.join(' && ')

      const list = await monitoramentoLegislativoService.list(tenant.id, filterStr)
      setPublicacoes(list)
    } catch (err) {
      console.error('Erro ao carregar publicações:', err)
      toast({
        title: 'Erro ao carregar publicações',
        description: 'Não foi possível consultar as normas cadastradas.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarPublicacoes()
  }, [tenant?.id, filtroFonte, filtroClassificacao, filtroCriticidade, filtroStatus])

  // Calcular impacto inicial no Comparador Avulso
  useEffect(() => {
    if (tenant?.id) {
      handleCalcularComparador()
    }
  }, [tenant?.id])

  const handleCalcularComparador = async () => {
    if (!tenant?.id) return
    setCalculandoComp(true)
    try {
      const res = await monitoramentoLegislativoService.calcularImpactoEmpresas(
        tenant.id,
        compAliqAnt,
        compAliqNova,
      )
      setCompResultado(res)
    } catch (err: any) {
      toast({
        title: 'Erro no cálculo do comparador',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCalculandoComp(false)
    }
  }

  const handleEnviarAlertaComparador = async () => {
    if (!tenant?.id || !compResultado) return
    setNotificandoImpacto(true)
    try {
      await notificacoesService.criarNotificacao({
        tenant_id: tenant.id,
        usuario_destino_id: user?.id,
        titulo: `Alerta Tributário: Simulação de Alteração de Alíquota (${compTributo})`,
        mensagem: `Variação simulada de ${compAliqAnt}% para ${compAliqNova}%. Impacto estimado na carteira de R$ ${compResultado.impactoFinanceiroMensalTotal.toLocaleString('pt-BR')}/mês em ${compResultado.totalEmpresasAfetadas} empresas.`,
        tipo: 'sistema',
        link: '/monitoramento-legislativo',
      })

      await auditService.log(
        tenant.id,
        user?.id || '',
        'criar',
        'publicacoes_legislativas',
        'comparador_avulso',
        JSON.stringify({
          tributo: compTributo,
          aliqAnt: compAliqAnt,
          aliqNova: compAliqNova,
          impactoTotal: compResultado.impactoFinanceiroMensalTotal,
        }),
      )

      toast({
        title: 'Alerta gerado com sucesso!',
        description: 'Notificação gravada no sino e pronta para o disparo matinal de e-mail.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar notificação',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setNotificandoImpacto(false)
    }
  }

  const handleSalvarNovaPub = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id) return
    if (!podeEditar) {
      toast({
        title: 'Permissão insuficiente',
        description: 'Apenas contadores e administradores podem cadastrar publicações.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoPub(true)
    try {
      const aliqAntNum = novoAliqAnt ? parseFloat(novoAliqAnt.replace(',', '.')) : undefined
      const aliqNovaNum = novoAliqNova ? parseFloat(novoAliqNova.replace(',', '.')) : undefined

      // Se for alteração de alíquota, calcular impacto nas empresas
      let impactoJson: ImpactoCalculadoJson | undefined
      if (novoClassificacao === 'aliquota' && aliqNovaNum !== undefined) {
        impactoJson = await monitoramentoLegislativoService.calcularImpactoEmpresas(
          tenant.id,
          aliqAntNum || 0,
          aliqNovaNum,
        )
      }

      const criada = await monitoramentoLegislativoService.create({
        tenant_id: tenant.id,
        titulo: novoTitulo,
        numero_norma: novoNorma,
        fonte: novoFonte,
        data_publicacao: `${novoDataPub} 08:00:00.000Z`,
        classificacao: novoClassificacao,
        criticidade: novoCriticidade,
        resumo: novoResumo,
        link_oficial: novoLink || undefined,
        tributo_afetado: novoTributo || undefined,
        aliquota_anterior: aliqAntNum,
        aliquota_nova: aliqNovaNum,
        regimes_afetados_json: ['simples_nacional', 'lucro_presumido', 'lucro_real'],
        setores_afetados_json: ['todos'],
        status: 'nova',
        origem_captura: 'manual_supervisionado',
      })

      // Se tiver impacto calculado, atualizar o registro
      if (impactoJson) {
        await monitoramentoLegislativoService.update(criada.id, {
          impacto_calculado_json: impactoJson,
        })
      }

      // Se for criticidade alta, criar notificação imediata
      if (novoCriticidade === 'alta') {
        await notificacoesService.criarNotificacao({
          tenant_id: tenant.id,
          usuario_destino_id: user?.id,
          titulo: `Alerta Legislativo: ${novoNorma} (${novoTributo || 'Tributário'})`,
          mensagem: `${novoTitulo}. ${novoResumo.slice(0, 150)}...`,
          tipo: 'sistema',
          link: '/monitoramento-legislativo',
        })
      }

      await auditService.log(
        tenant.id,
        user?.id || '',
        'criar',
        'publicacoes_legislativas',
        criada.id,
        JSON.stringify({ norma: novoNorma, titulo: novoTitulo, criticidade: novoCriticidade }),
      )

      toast({
        title: 'Publicação cadastrada com sucesso!',
        description: `Norma ${novoNorma} integrada com classificação de impacto na carteira.`,
      })

      setModalNovoAberto(false)
      // Limpar form
      setNovoTitulo('')
      setNovoNorma('')
      setNovoResumo('')
      setNovoLink('')
      setNovoTributo('')
      setNovoAliqAnt('')
      setNovoAliqNova('')
      carregarPublicacoes()
    } catch (err: any) {
      toast({
        title: 'Erro ao cadastrar publicação',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoPub(false)
    }
  }

  const handleImportarTextoJson = async () => {
    if (!tenant?.id || !textoColado.trim()) return
    setImportando(true)
    try {
      let dados: any
      try {
        dados = JSON.parse(textoColado)
      } catch {
        // Se for texto livre, estruturar como publicação supervisionada
        dados = {
          titulo: textoColado.split('\n')[0].slice(0, 100),
          numero_norma: 'Ato Normativo Extraído',
          fonte: 'dou',
          classificacao: 'norma_geral',
          criticidade: 'media',
          resumo: textoColado.slice(0, 300),
        }
      }

      const lista = Array.isArray(dados) ? dados : [dados]
      for (const item of lista) {
        await monitoramentoLegislativoService.create({
          tenant_id: tenant.id,
          titulo: item.titulo || 'Nova Norma Publicada',
          numero_norma: item.numero_norma || item.norma || 'Norma/2026',
          fonte: item.fonte || 'dou',
          data_publicacao: item.data_publicacao || new Date().toISOString(),
          classificacao: item.classificacao || 'norma_geral',
          criticidade: item.criticidade || 'media',
          resumo: item.resumo || item.ementa || 'Texto importado via monitoramento.',
          tributo_afetado: item.tributo_afetado,
          aliquota_anterior: item.aliquota_anterior,
          aliquota_nova: item.aliquota_nova,
          status: 'nova',
          origem_captura: 'importacao_json',
        })
      }

      toast({
        title: 'Importação concluída',
        description: `${lista.length} publicação(ões) importada(s) com sucesso.`,
      })
      setModalImportAberto(false)
      setTextoColado('')
      carregarPublicacoes()
    } catch (err: any) {
      toast({
        title: 'Erro na importação',
        description: err.message || 'Formato de dados não reconhecido.',
        variant: 'destructive',
      })
    } finally {
      setImportando(false)
    }
  }

  const handleMarcarAnalisada = async () => {
    if (!pubSelecionada || !user) return
    setAnalisando(true)
    try {
      await monitoramentoLegislativoService.marcarComoAnalisada(
        pubSelecionada.id,
        user.id,
        notasAnalise,
      )
      toast({
        title: 'Publicação revisada',
        description: 'A norma foi marcada como analisada pelo contador.',
      })
      setPubSelecionada(null)
      setNotasAnalise('')
      carregarPublicacoes()
    } catch (err: any) {
      toast({
        title: 'Erro ao revisar publicação',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setAnalisando(false)
    }
  }

  const handleArquivar = async (pub: PublicacaoLegislativaRecord) => {
    try {
      await monitoramentoLegislativoService.arquivar(pub.id)
      toast({
        title: 'Publicação arquivada',
        description: 'Item movido para o histórico.',
      })
      carregarPublicacoes()
    } catch (err: any) {
      toast({
        title: 'Erro ao arquivar',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Filtragem de texto
  const pubsFiltradas = publicacoes.filter((p) => {
    if (!termoBusca) return true
    const term = termoBusca.toLowerCase()
    return (
      p.titulo.toLowerCase().includes(term) ||
      p.numero_norma.toLowerCase().includes(term) ||
      p.resumo.toLowerCase().includes(term) ||
      (p.tributo_afetado && p.tributo_afetado.toLowerCase().includes(term))
    )
  })

  const getCriticidadeBadge = (crit: PublicacaoCriticidade) => {
    switch (crit) {
      case 'alta':
        return (
          <Badge className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold gap-1">
            <AlertTriangle className="w-3 h-3" /> Alta Criticidade
          </Badge>
        )
      case 'media':
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold">
            Média
          </Badge>
        )
      case 'baixa':
        return (
          <Badge variant="outline" className="text-slate-600 border-slate-300 text-[11px]">
            Informativo
          </Badge>
        )
    }
  }

  const getFonteBadge = (fonte: PublicacaoFonte) => {
    switch (fonte) {
      case 'dou':
        return <Badge className="bg-slate-900 text-white text-[10px]">DOU Federal</Badge>
      case 'rfb':
        return <Badge className="bg-blue-700 text-white text-[10px]">RFB Normas</Badge>
      case 'comite_gestor_ibs':
        return <Badge className="bg-indigo-700 text-white text-[10px]">Comitê Gestor IBS</Badge>
      case 'sefaz_estadual':
        return <Badge className="bg-emerald-700 text-white text-[10px]">SEFAZ Estadual</Badge>
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            Outros
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Monitoramento Legislativo & Alíquotas
            </h1>
            <Badge
              variant="outline"
              className="text-blue-700 border-blue-200 bg-blue-50 text-[11px]"
            >
              Job 08h Ativo
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhamento contínuo do Diário Oficial, Receita Federal e SEFAZ com cálculo
            automatizado de impacto financeiro por empresa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalImportAberto(true)}
            className="h-9 text-xs gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Importar Texto / JSON
          </Button>

          {podeEditar && (
            <Button
              size="sm"
              onClick={() => setModalNovoAberto(true)}
              className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Cadastrar Publicação
            </Button>
          )}
        </div>
      </div>

      {/* BANNER DE TRANSPARÊNCIA E PONTO DE EXTENSÃO */}
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 text-xs space-y-2">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-600 text-white rounded-lg mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-amber-950 text-sm">
                Transparência de Conectores Externos (DOU / Querido Diário / SEFAZ)
              </h4>
              <Badge
                variant="outline"
                className="bg-white text-amber-900 border-amber-300 text-[10px]"
              >
                Modo Supervisão Ativo
              </Badge>
            </div>
            <p className="text-amber-900/90 text-xs mt-1 leading-relaxed">
              A varredura automática em tempo real do Diário Oficial da União depende de credenciais
              de API corporativa (ex: API Oficial do DOU ou tokens do Querido Diário). Como o
              ambiente opera sem credenciais externas injetadas, a plataforma adota o{' '}
              <strong>modo supervisão transparente</strong>: o motor de análise, o comparador de
              alíquotas com cálculo de impacto na carteira e o{' '}
              <strong>job diário das 08h com anti-flood</strong> funcionam com publicações
              cadastradas, importadas via JSON ou texto.
            </p>
            <p className="text-[11px] text-amber-800 font-mono mt-1.5">
              💡 Ponto de extensão documentado em{' '}
              <code className="bg-amber-100 px-1 py-0.5 rounded">
                src/services/monitoramentoLegislativo.ts
              </code>{' '}
              (função simularVarreduraApiDou) pronto para conectar o gateway HTTP sem alterar a
              interface.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="feed" className="w-full space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger
            value="feed"
            className="gap-2 text-xs py-2 px-4 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-xs"
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            Feed de Publicações Normativas ({pubsFiltradas.length})
          </TabsTrigger>
          <TabsTrigger
            value="comparador"
            className="gap-2 text-xs py-2 px-4 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-xs"
          >
            <Calculator className="w-3.5 h-3.5 text-indigo-600" />
            Comparador de Alíquotas & Impacto Carteira
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: FEED DE PUBLICAÇÕES */}
        <TabsContent value="feed" className="space-y-4 m-0">
          {/* BARRA DE FILTROS */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-2.5 items-center justify-between text-xs">
            <div className="relative flex-1 w-full md:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Buscar por norma, tributo ou palavra-chave..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Select value={filtroFonte} onValueChange={setFiltroFonte}>
                <SelectTrigger className="h-8 text-xs w-[120px]">
                  <SelectValue placeholder="Fonte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todas as fontes
                  </SelectItem>
                  <SelectItem value="dou" className="text-xs">
                    DOU Federal
                  </SelectItem>
                  <SelectItem value="rfb" className="text-xs">
                    RFB
                  </SelectItem>
                  <SelectItem value="comite_gestor_ibs" className="text-xs">
                    Comitê IBS
                  </SelectItem>
                  <SelectItem value="sefaz_estadual" className="text-xs">
                    SEFAZ PR/SP
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroClassificacao} onValueChange={setFiltroClassificacao}>
                <SelectTrigger className="h-8 text-xs w-[130px]">
                  <SelectValue placeholder="Classificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todas classificações
                  </SelectItem>
                  <SelectItem value="aliquota" className="text-xs">
                    Mudança de Alíquota
                  </SelectItem>
                  <SelectItem value="obrigacao_acessoria" className="text-xs">
                    Obrigação Acessória
                  </SelectItem>
                  <SelectItem value="prazo" className="text-xs">
                    Prorrogação de Prazo
                  </SelectItem>
                  <SelectItem value="norma_geral" className="text-xs">
                    Norma Geral
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroCriticidade} onValueChange={setFiltroCriticidade}>
                <SelectTrigger className="h-8 text-xs w-[120px]">
                  <SelectValue placeholder="Criticidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todas criticidades
                  </SelectItem>
                  <SelectItem value="alta" className="text-xs">
                    Alta
                  </SelectItem>
                  <SelectItem value="media" className="text-xs">
                    Média
                  </SelectItem>
                  <SelectItem value="baixa" className="text-xs">
                    Baixa
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="h-8 text-xs w-[110px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">
                    Todos status
                  </SelectItem>
                  <SelectItem value="nova" className="text-xs">
                    Nova
                  </SelectItem>
                  <SelectItem value="analisada" className="text-xs">
                    Analisada
                  </SelectItem>
                  <SelectItem value="arquivada" className="text-xs">
                    Arquivada
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* LISTA DO FEED */}
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              Carregando feed legislativo...
            </div>
          ) : pubsFiltradas.length === 0 ? (
            <Card className="border-slate-200 p-12 text-center text-slate-500 space-y-2">
              <Scale className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-medium">
                Nenhuma publicação encontrada para os filtros atuais.
              </p>
              <p className="text-xs text-slate-400">
                Tente ajustar os critérios ou cadastre uma nova norma.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pubsFiltradas.map((pub) => {
                const temImpacto =
                  pub.impacto_calculado_json && pub.impacto_calculado_json.totalEmpresasAfetadas > 0

                return (
                  <Card
                    key={pub.id}
                    className="border-slate-200 shadow-xs hover:border-slate-300 transition-colors"
                  >
                    <CardContent className="p-5 space-y-3 text-xs">
                      {/* Topo do item */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {getFonteBadge(pub.fonte)}
                          <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {pub.numero_norma}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500 text-[11px]">
                            Publicada em:{' '}
                            {new Date(pub.data_publicacao).toLocaleDateString('pt-BR')}
                          </span>
                          {pub.tributo_afetado && (
                            <Badge
                              variant="outline"
                              className="text-slate-700 bg-slate-50 text-[10px]"
                            >
                              {pub.tributo_afetado}
                            </Badge>
                          )}
                          {getCriticidadeBadge(pub.criticidade)}
                        </div>

                        <div className="flex items-center gap-2">
                          {pub.status === 'nova' ? (
                            <Badge className="bg-amber-100 text-amber-800 text-[10px] border border-amber-200">
                              Nova
                            </Badge>
                          ) : pub.status === 'analisada' ? (
                            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] border border-emerald-200">
                              ✓ Analisada
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500 text-[10px]">
                              Arquivada
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Título e Resumo */}
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">
                          {pub.titulo}
                        </h3>
                        <p className="text-slate-600 mt-1 leading-relaxed">{pub.resumo}</p>
                      </div>

                      {/* Box de Mudança de Alíquota e Impacto Financeiro na Carteira */}
                      {pub.classificacao === 'aliquota' && (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] font-semibold text-slate-600">
                                Alíquota:
                              </span>
                              <span className="text-slate-500 line-through font-mono">
                                {pub.aliquota_anterior !== undefined
                                  ? `${pub.aliquota_anterior}%`
                                  : 'N/A'}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-bold text-slate-900 font-mono text-sm">
                                {pub.aliquota_nova !== undefined ? `${pub.aliquota_nova}%` : 'N/A'}
                              </span>
                            </div>

                            {temImpacto && (
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-600">
                                  Empresas afetadas:{' '}
                                  <strong>
                                    {pub.impacto_calculado_json?.totalEmpresasAfetadas}
                                  </strong>
                                </span>
                                <span className="text-slate-400">•</span>
                                <span className="font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[11px]">
                                  Impacto Mensal: +R${' '}
                                  {pub.impacto_calculado_json?.impactoFinanceiroMensalTotal.toLocaleString(
                                    'pt-BR',
                                  )}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Detalhe por empresa afetada */}
                          {pub.impacto_calculado_json?.detalhesPorEmpresa &&
                            pub.impacto_calculado_json.detalhesPorEmpresa.length > 0 && (
                              <div className="divide-y divide-slate-200/60 pt-1 text-[11px]">
                                {pub.impacto_calculado_json.detalhesPorEmpresa.map((emp, i) => (
                                  <div
                                    key={i}
                                    className="py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                                  >
                                    <div>
                                      <span className="font-semibold text-slate-800">
                                        {emp.nome}:
                                      </span>{' '}
                                      <span className="text-slate-600">{emp.orientacao}</span>
                                    </div>
                                    <span className="font-mono font-medium text-red-700 shrink-0">
                                      {emp.impactoFinanceiro > 0
                                        ? `+R$ ${emp.impactoFinanceiro}/mês`
                                        : 'Neutro'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                      )}

                      {/* Rodapé do card: Ações e Auditoria */}
                      <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                        <div className="text-[11px] text-slate-400">
                          {pub.analisado_em && (
                            <span>
                              Analisada em {new Date(pub.analisado_em).toLocaleDateString('pt-BR')}{' '}
                              por contador responsável.
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {pub.link_oficial && (
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-blue-600 hover:text-blue-700 p-0 px-2 gap-1"
                            >
                              <a href={pub.link_oficial} target="_blank" rel="noreferrer">
                                <ExternalLink className="w-3 h-3" />
                                <span>Texto Oficial</span>
                              </a>
                            </Button>
                          )}

                          {podeEditar && pub.status === 'nova' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1"
                              onClick={() => {
                                setPubSelecionada(pub)
                                setNotasAnalise(pub.notas_analise || '')
                              }}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Marcar Analisada</span>
                            </Button>
                          )}

                          {podeEditar && pub.status !== 'arquivada' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-slate-500 hover:text-slate-700 p-0 px-2 gap-1"
                              onClick={() => handleArquivar(pub)}
                            >
                              <Archive className="w-3 h-3" />
                              <span>Arquivar</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ABA 2: COMPARADOR DE ALÍQUOTAS & IMPACTO CARTEIRA */}
        <TabsContent value="comparador" className="space-y-6 m-0">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-600" />
                Simulador Dinâmico de Alteração de Alíquota
              </CardTitle>
              <CardDescription className="text-xs">
                Informe a alíquota antiga e nova para que o sistema cruze imediatamente com as
                apurações recentes das empresas e projete o impacto financeiro.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-6 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tributo / Matéria</Label>
                  <Input
                    placeholder="Ex: CBS, IBS, ICMS PR"
                    value={compTributo}
                    onChange={(e) => setCompTributo(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Alíquota Anterior (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.65"
                    value={compAliqAnt}
                    onChange={(e) => setCompAliqAnt(parseFloat(e.target.value) || 0)}
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Alíquota Nova Prevista (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.90"
                    value={compAliqNova}
                    onChange={(e) => setCompAliqNova(parseFloat(e.target.value) || 0)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleCalcularComparador}
                  disabled={calculandoComp}
                  className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  Calcular Impacto na Carteira
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEnviarAlertaComparador}
                  disabled={notificandoImpacto || !compResultado}
                  className="h-9 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Gerar Alerta com Anti-Flood no Sino
                </Button>
              </div>

              {/* RESULTADO DO COMPARADOR */}
              {compResultado && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <span className="text-[11px] text-slate-500 uppercase">
                        Variação da Alíquota
                      </span>
                      <div className="text-xl font-bold text-slate-900 font-mono">
                        {compResultado.variacaoPercentualAliquota !== undefined &&
                        compResultado.variacaoPercentualAliquota > 0
                          ? `+${compResultado.variacaoPercentualAliquota}%`
                          : `${compResultado.variacaoPercentualAliquota}%`}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        De {compAliqAnt}% para {compAliqNova}%
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <span className="text-[11px] text-slate-500 uppercase">
                        Empresas Afetadas
                      </span>
                      <div className="text-xl font-bold text-blue-700 font-mono">
                        {compResultado.totalEmpresasAfetadas}
                      </div>
                      <p className="text-[10px] text-slate-400">Com base nos regimes e CNAEs</p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 space-y-1">
                      <span className="text-[11px] text-red-700 uppercase font-semibold">
                        Impacto Mensal Total
                      </span>
                      <div className="text-xl font-bold text-red-700 font-mono">
                        + R${' '}
                        {compResultado.impactoFinanceiroMensalTotal.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                      <p className="text-[10px] text-red-600">
                        Acréscimo estimado de custo tributário
                      </p>
                    </div>
                  </div>

                  {/* TABELA DE IMPACTO POR EMPRESA */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Empresa</th>
                          <th className="py-2.5 px-3">Regime</th>
                          <th className="py-2.5 px-3 text-right">Fat. Médio Mensal</th>
                          <th className="py-2.5 px-3 text-right">Custo Anterior</th>
                          <th className="py-2.5 px-3 text-right">Novo Custo Previsto</th>
                          <th className="py-2.5 px-3 text-right font-bold text-red-700">
                            Impacto Mensal
                          </th>
                          <th className="py-2.5 px-3">Recomendação Contábil</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {compResultado.detalhesPorEmpresa.map((item) => (
                          <tr key={item.empresaId} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {item.nome}
                            </td>
                            <td className="py-2.5 px-3 capitalize">
                              <Badge variant="outline" className="text-[10px]">
                                {item.regime?.replace('_', ' ')}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              R$ {item.faturamentoMedioMensal.toLocaleString('pt-BR')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              R$ {item.custoAnteriorMensal.toLocaleString('pt-BR')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-semibold">
                              R$ {item.custoNovoMensal.toLocaleString('pt-BR')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-red-700">
                              +R$ {item.impactoFinanceiro.toLocaleString('pt-BR')}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 text-[11px] max-w-xs">
                              {item.orientacao}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: CADASTRAR PUBLICAÇÃO MANUAL */}
      <Dialog open={modalNovoAberto} onOpenChange={setModalNovoAberto}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6 text-xs">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Cadastrar Publicação Legislativa
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registre a norma oficial para classificação de impacto na carteira e alerta
              automático.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarNovaPub} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Título da Publicação *</Label>
              <Input
                required
                placeholder="Ex: Regulamentação de Alíquotas de Transição CBS/IBS"
                value={novoTitulo}
                onChange={(e) => setNovoTitulo(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Número da Norma *</Label>
                <Input
                  required
                  placeholder="Ex: LC nº 214/2025"
                  value={novoNorma}
                  onChange={(e) => setNovoNorma(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Fonte Oficial *</Label>
                <Select value={novoFonte} onValueChange={(v) => setNovoFonte(v as PublicacaoFonte)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dou" className="text-xs">
                      DOU (Diário Oficial da União)
                    </SelectItem>
                    <SelectItem value="rfb" className="text-xs">
                      Receita Federal do Brasil
                    </SelectItem>
                    <SelectItem value="comite_gestor_ibs" className="text-xs">
                      Comitê Gestor IBS
                    </SelectItem>
                    <SelectItem value="sefaz_estadual" className="text-xs">
                      SEFAZ Estadual
                    </SelectItem>
                    <SelectItem value="outros" className="text-xs">
                      Outros Órgãos
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data Publicação *</Label>
                <Input
                  type="date"
                  required
                  value={novoDataPub}
                  onChange={(e) => setNovoDataPub(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Classificação</Label>
                <Select
                  value={novoClassificacao}
                  onValueChange={(v) => setNovoClassificacao(v as PublicacaoClassificacao)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aliquota" className="text-xs">
                      Mudança de Alíquota
                    </SelectItem>
                    <SelectItem value="obrigacao_acessoria" className="text-xs">
                      Obrigação Acessória
                    </SelectItem>
                    <SelectItem value="prazo" className="text-xs">
                      Prorrogação de Prazo
                    </SelectItem>
                    <SelectItem value="norma_geral" className="text-xs">
                      Norma Geral
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Criticidade</Label>
                <Select
                  value={novoCriticidade}
                  onValueChange={(v) => setNovoCriticidade(v as PublicacaoCriticidade)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta" className="text-xs">
                      Alta (Alerta Imediato)
                    </SelectItem>
                    <SelectItem value="media" className="text-xs">
                      Média
                    </SelectItem>
                    <SelectItem value="baixa" className="text-xs">
                      Baixa / Informativo
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {novoClassificacao === 'aliquota' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tributo Afetado</Label>
                  <Input
                    placeholder="Ex: CBS, IBS, ICMS"
                    value={novoTributo}
                    onChange={(e) => setNovoTributo(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Alíquota Anterior (%)</Label>
                  <Input
                    placeholder="0.65"
                    value={novoAliqAnt}
                    onChange={(e) => setNovoAliqAnt(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Alíquota Nova (%)</Label>
                  <Input
                    placeholder="0.90"
                    value={novoAliqNova}
                    onChange={(e) => setNovoAliqNova(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Resumo / Ementa *</Label>
              <Textarea
                required
                rows={3}
                placeholder="Descreva as alterações principais e o impacto na rotina contábil/fiscal..."
                value={novoResumo}
                onChange={(e) => setNovoResumo(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Link Oficial da Publicação</Label>
              <Input
                placeholder="https://www.in.gov.br/..."
                value={novoLink}
                onChange={(e) => setNovoLink(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalNovoAberto(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={salvandoPub}
              >
                {salvandoPub ? 'Salvando...' : 'Cadastrar Publicação'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: IMPORTAR TEXTO / JSON */}
      <Dialog open={modalImportAberto} onOpenChange={setModalImportAberto}>
        <DialogContent className="max-w-xl p-6 text-xs">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Importação Rápida por Texto ou JSON
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cole o texto de uma notícia/resolução do DOU ou uma lista JSON extraída de conectores
              externos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Textarea
              rows={8}
              placeholder={`Cole o texto da publicação ou JSON:\n{\n  "titulo": "Portaria RFB...",\n  "numero_norma": "Portaria 2026/01",\n  "classificacao": "obrigacao_acessoria",\n  "resumo": "..."\n}`}
              value={textoColado}
              onChange={(e) => setTextoColado(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalImportAberto(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleImportarTextoJson}
              disabled={importando || !textoColado.trim()}
            >
              {importando ? 'Importando...' : 'Processar e Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: MARCAR COMO ANALISADA */}
      <Dialog open={!!pubSelecionada} onOpenChange={(open) => !open && setPubSelecionada(null)}>
        <DialogContent className="max-w-md p-6 text-xs">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Revisar Norma & Marcar Analisada
            </DialogTitle>
            <DialogDescription className="text-xs">
              {pubSelecionada?.numero_norma} - {pubSelecionada?.titulo}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Notas e Parecer da Análise Contábil</Label>
              <Textarea
                rows={4}
                placeholder="Ex: Impacto verificado na carteira. Clientes orientados quanto ao novo recolhimento."
                value={notasAnalise}
                onChange={(e) => setNotasAnalise(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPubSelecionada(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleMarcarAnalisada}
              disabled={analisando}
            >
              {analisando ? 'Salvando...' : 'Confirmar Análise'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default MonitoramentoLegislativoPage

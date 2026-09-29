import { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import {
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  Eye,
  RefreshCw,
  Send,
  Info,
  ShieldAlert,
  FileCheck,
  Search,
  Filter,
  Check,
  Code,
  Layers,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { spedService, VERSOES_SPED, calculateMd5 } from '@/services/sped'
import { auditService } from '@/services/audit'
import { BadgeTransmissaoAutonomia } from '@/components/BadgeTransmissaoAutonomia'
import type {
  SpedArquivoRecord,
  SpedTipoArquivo,
  SpedFinalidade,
  SpedStatus,
  Empresa,
  ValidacaoSpedResult,
} from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

interface SpedEscrituracaoTabProps {
  empresas: Empresa[]
  selectedEmpresaId: string
  onSelectEmpresa?: (empresaId: string) => void
}

export function SpedEscrituracaoTab({ empresas, selectedEmpresaId }: SpedEscrituracaoTabProps) {
  const { tenant, user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [arquivos, setArquivos] = useState<SpedArquivoRecord[]>([])
  const [empresaFiltro, setEmpresaFiltro] = useState<string>(selectedEmpresaId || 'todas')
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos')
  const [statusFiltro, setStatusFiltro] = useState<string>('todos')

  // Estado do formulário de geração
  const [formEmpresa, setFormEmpresa] = useState<string>(
    selectedEmpresaId || (empresas.length > 0 ? empresas[0].id : ''),
  )
  const [formTipo, setFormTipo] = useState<SpedTipoArquivo>('ecd')
  const [formCompetencia, setFormCompetencia] = useState<string>('08/2026')
  const [formVersao, setFormVersao] = useState<string>('v010')
  const [formFinalidade, setFormFinalidade] = useState<SpedFinalidade>('original')
  const [gerando, setGerando] = useState(false)

  // Validação prévia
  const [validando, setValidando] = useState(false)
  const [validacaoResult, setValidacaoResult] = useState<ValidacaoSpedResult | null>(null)

  // Modal de visualização de linhas
  const [visualizandoArquivo, setVisualizandoArquivo] = useState<SpedArquivoRecord | null>(null)
  const [linhasSped, setLinhasSped] = useState<string[]>([])
  const [filtroBlocoLinha, setFiltroBlocoLinha] = useState<string>('todos')

  // Modal de transmissão / validação manual
  const [arquivoParaTransmitir, setArquivoParaTransmitir] = useState<SpedArquivoRecord | null>(null)
  const [reciboPva, setReciboPva] = useState('')
  const [obsPva, setObsPva] = useState('')

  // Certificado ativo vinculado
  const [temCertificadoAtivo, setTemCertificadoAtivo] = useState(false)

  // Permissão por perfil
  const podeEditar = user?.perfil === 'administrador' || user?.perfil === 'contador'

  useEffect(() => {
    if (selectedEmpresaId) {
      setEmpresaFiltro(selectedEmpresaId)
      setFormEmpresa(selectedEmpresaId)
    }
  }, [selectedEmpresaId])

  useEffect(() => {
    // Atualizar versão padrão ao trocar tipo
    const versoes = VERSOES_SPED[formTipo]
    if (versoes && versoes.length > 0) {
      setFormVersao(versoes[0].versao)
    }
    setValidacaoResult(null)
  }, [formTipo])

  const carregarArquivos = async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const filters: string[] = []
      if (empresaFiltro && empresaFiltro !== 'todas') {
        filters.push(`empresa = "${empresaFiltro}"`)
      }
      if (tipoFiltro && tipoFiltro !== 'todos') {
        filters.push(`tipo = "${tipoFiltro}"`)
      }
      if (statusFiltro && statusFiltro !== 'todos') {
        filters.push(`status = "${statusFiltro}"`)
      }
      const filterStr = filters.join(' && ')
      const lista = await spedService.list(tenant.id, filterStr)
      setArquivos(lista)
    } catch (err) {
      console.error('Erro ao carregar arquivos SPED:', err)
      toast({
        title: 'Erro ao carregar arquivos',
        description: 'Não foi possível buscar os arquivos SPED gerados.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarArquivos()
  }, [tenant?.id, empresaFiltro, tipoFiltro, statusFiltro])

  useEffect(() => {
    const checarCertificado = async () => {
      const empId = formEmpresa || empresaFiltro
      if (!empId || empId === 'todas') {
        setTemCertificadoAtivo(false)
        return
      }
      try {
        const certs = await pb.collection('certificados_digitais').getFullList({
          filter: `empresa = "${empId}" && status = "ativo"`,
        })
        setTemCertificadoAtivo(certs.length > 0)
      } catch {
        setTemCertificadoAtivo(false)
      }
    }
    checarCertificado()
  }, [formEmpresa, empresaFiltro])

  const handleValidarPrevia = async () => {
    if (!tenant?.id || !formEmpresa) return
    setValidando(true)
    try {
      const res = await spedService.validarPreGeracao(
        tenant.id,
        formEmpresa,
        formTipo,
        formCompetencia,
      )
      setValidacaoResult(res)
      if (res.valido) {
        toast({
          title: 'Estrutura validada com sucesso',
          description: `Empresa e competência ${formCompetencia} aptas para escrituração SPED ${formTipo.toUpperCase()}.`,
        })
      } else {
        toast({
          title: 'Atenção aos dados cadastrais',
          description: 'Foram identificadas inconsistências bloqueantes.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Falha na validação',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setValidando(false)
    }
  }

  const handleGerarSped = async () => {
    if (!tenant?.id || !formEmpresa) {
      toast({
        title: 'Selecione a empresa',
        description: 'É necessário selecionar a empresa contribuinte para gerar a escrituração.',
        variant: 'destructive',
      })
      return
    }

    if (!podeEditar) {
      toast({
        title: 'Permissão insuficiente',
        description: 'Seu perfil permite apenas consulta aos arquivos SPED.',
        variant: 'destructive',
      })
      return
    }

    setGerando(true)
    try {
      const arq = await spedService.gerarArquivoSped({
        tenantId: tenant.id,
        empresaId: formEmpresa,
        tipo: formTipo,
        competencia: formCompetencia,
        versaoLayout: formVersao,
        finalidade: formFinalidade,
        userId: user?.id,
      })

      // Registrar auditoria
      await auditService.log(
        tenant.id,
        user?.id || '',
        'criar',
        'sped_arquivos',
        arq.id,
        JSON.stringify({
          tipo: formTipo,
          competencia: formCompetencia,
          linhas: arq.total_linhas,
          hash: arq.hash_md5,
        }),
      )

      toast({
        title: 'Arquivo SPED gerado com sucesso!',
        description: `${arq.total_linhas} linhas geradas no layout ${formVersao}. Hash MD5: ${arq.hash_md5.slice(0, 8)}...`,
      })

      setValidacaoResult(null)
      carregarArquivos()
    } catch (err: any) {
      console.error('Erro ao gerar SPED:', err)
      toast({
        title: 'Não foi possível gerar o arquivo',
        description: err.message || 'Verifique se a competência possui movimentação escriturada.',
        variant: 'destructive',
      })
    } finally {
      setGerando(false)
    }
  }

  const abrirVisualizador = (arq: SpedArquivoRecord) => {
    setVisualizandoArquivo(arq)
    if (arq.conteudo_txt) {
      const splitLines = arq.conteudo_txt.split(/\r?\n/).filter((l) => l.trim().length > 0)
      setLinhasSped(splitLines)
    } else {
      setLinhasSped([])
    }
    setFiltroBlocoLinha('todos')
  }

  const handleSalvarTransmissao = async () => {
    if (!arquivoParaTransmitir) return
    try {
      await spedService.updateStatus(
        arquivoParaTransmitir.id,
        'transmitido_manual',
        reciboPva,
        obsPva,
      )
      toast({
        title: 'Status atualizado com sucesso',
        description: 'O arquivo foi marcado como assinado e transmitido via PVA.',
      })
      setArquivoParaTransmitir(null)
      setReciboPva('')
      setObsPva('')
      carregarArquivos()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar status',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const getTipoBadge = (tipo: SpedTipoArquivo) => {
    switch (tipo) {
      case 'ecd':
        return <Badge className="bg-sky-600 text-white">SPED ECD (Contábil)</Badge>
      case 'ecf':
        return <Badge className="bg-indigo-600 text-white">SPED ECF (IRPJ/Lalur)</Badge>
      case 'efd_icms_ipi':
        return <Badge className="bg-amber-600 text-white">EFD-ICMS/IPI (Fiscal)</Badge>
      case 'efd_contribuicoes':
        return (
          <Badge className="bg-emerald-600 text-white">EFD-Contribuições (PIS/COFINS/CBS)</Badge>
        )
      default:
        return <Badge variant="outline">{tipo}</Badge>
    }
  }

  const getStatusBadge = (status: SpedStatus) => {
    switch (status) {
      case 'gerado':
        return (
          <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
            Gerado (Pendente PVA)
          </Badge>
        )
      case 'validado':
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-50">
            Validado no PVA
          </Badge>
        )
      case 'transmitido_manual':
        return (
          <Badge className="bg-green-600 text-white flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Transmitido RFB
          </Badge>
        )
    }
  }

  const linhasFiltradas = linhasSped.filter((linha) => {
    if (filtroBlocoLinha === 'todos') return true
    return linha.startsWith(`|${filtroBlocoLinha}`)
  })

  return (
    <div className="space-y-6">
      {/* BANNER DE TRANSPARÊNCIA DE INTEGRAÇÃO */}
      <div className="p-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/80">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-slate-900 text-sm">
                  Transparência de Conformidade e Transmissão SPED
                </h4>
                <BadgeTransmissaoAutonomia
                  tipo="certificado_a1"
                  isCredenciado={temCertificadoAtivo}
                  detalhe={
                    temCertificadoAtivo
                      ? 'Certificado A1 ativo vinculado à empresa. Geração, assinatura e validação SPED com credenciamento ativo.'
                      : 'Certificado A1 ausente ou pendente na empresa selecionada. A escrituração SPED opera em Modo Supervisão para validação contábil humana via PVA.'
                  }
                  configUrl="/obrigacoes"
                />
                <Badge variant="outline" className="text-slate-600 border-slate-300 text-[10px]">
                  Guia Prático RFB / COTEPE
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 max-w-3xl">
                Os arquivos .txt são gerados rigorosamente nos{' '}
                <strong>layouts oficiais vigentes</strong> (Manual de Orientação da RFB e Guias
                Práticos COTEPE). Por exigência regulamentar da Receita Federal do Brasil, a{' '}
                <strong>assinatura digital com certificado e-CNPJ A1</strong> e o envio oficial são
                processados através do Programa Validador e Assinador (PVA / RFB).
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="bg-white text-slate-700 border-slate-300 font-mono text-xs py-1 px-2.5 whitespace-nowrap"
          >
            Hash MD5 Obrigatório
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FORMULÁRIO DE GERAÇÃO */}
        <Card className="lg:col-span-1 border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base font-semibold">Novo Arquivo SPED</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Selecione a empresa e competência para compilar os blocos e registros oficiais.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Empresa Contribuinte</Label>
              <Select value={formEmpresa} onValueChange={setFormEmpresa}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.nome_fantasia || emp.razao_social} ({emp.regime_tributario})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tipo de Arquivo SPED</Label>
              <Select value={formTipo} onValueChange={(val) => setFormTipo(val as SpedTipoArquivo)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ecd" className="text-xs">
                    SPED Contábil (ECD) - Livro Diário Geral
                  </SelectItem>
                  <SelectItem value="ecf" className="text-xs">
                    SPED ECF - IRPJ / CSLL Lalur
                  </SelectItem>
                  <SelectItem value="efd_icms_ipi" className="text-xs">
                    EFD-ICMS/IPI - Fiscal Estadual / IPI
                  </SelectItem>
                  <SelectItem value="efd_contribuicoes" className="text-xs">
                    EFD-Contribuições - PIS/COFINS e CBS
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Competência (MM/AAAA)</Label>
                <Input
                  className="h-9 text-xs"
                  placeholder="08/2026"
                  value={formCompetencia}
                  onChange={(e) => setFormCompetencia(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Finalidade</Label>
                <Select
                  value={formFinalidade}
                  onValueChange={(val) => setFormFinalidade(val as SpedFinalidade)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original" className="text-xs">
                      Original
                    </SelectItem>
                    <SelectItem value="retificadora" className="text-xs">
                      Retificadora
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Versão do Leiaute RFB</Label>
              <Select value={formVersao} onValueChange={setFormVersao}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VERSOES_SPED[formTipo]?.map((v) => (
                    <SelectItem key={v.versao} value={v.versao} className="text-xs">
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Painel de Validação Prévia */}
            {validacaoResult && (
              <div
                className={`p-3 rounded-lg border text-xs space-y-2 ${
                  validacaoResult.valido
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-red-200 bg-red-50 text-red-900'
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  {validacaoResult.valido ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  )}
                  <span>
                    {validacaoResult.valido
                      ? 'Parâmetros e Escrituração Aprovados'
                      : 'Inconsistências Identificadas'}
                  </span>
                </div>

                {validacaoResult.erros.length > 0 && (
                  <ul className="list-disc pl-4 space-y-1 text-red-700">
                    {validacaoResult.erros.map((e, idx) => (
                      <li key={idx}>
                        <strong>{e.campo}:</strong> {e.mensagem}
                      </li>
                    ))}
                  </ul>
                )}

                {validacaoResult.avisos.length > 0 && (
                  <ul className="list-disc pl-4 space-y-1 text-amber-800">
                    {validacaoResult.avisos.map((a, idx) => (
                      <li key={idx}>
                        <strong>Aviso:</strong> {a.mensagem}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs h-9"
                onClick={handleValidarPrevia}
                disabled={validando || !formEmpresa}
              >
                {validando ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                )}
                Pré-Validar Dados e Lançamentos
              </Button>

              <Button
                type="button"
                className="w-full text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleGerarSped}
                disabled={gerando || !podeEditar || !formEmpresa}
              >
                {gerando ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Code className="w-3.5 h-3.5 mr-1.5" />
                )}
                Compilar e Gerar Arquivo SPED
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* LISTA DE ARQUIVOS GERADOS */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm flex flex-col">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  Histórico de Escriturações Geradas
                </CardTitle>
                <CardDescription className="text-xs">
                  Arquivos prontos para importação no PVA, visualização de registros e controle de
                  transmissão.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs self-start sm:self-auto"
                onClick={carregarArquivos}
                disabled={loading}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            {/* FILTROS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
              <div>
                <Label className="text-[11px] text-slate-500">Filtrar Empresa</Label>
                <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todas as empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas" className="text-xs">
                      Todas as empresas
                    </SelectItem>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id} className="text-xs">
                        {e.nome_fantasia || e.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] text-slate-500">Filtrar Tipo</Label>
                <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos" className="text-xs">
                      Todos os tipos
                    </SelectItem>
                    <SelectItem value="ecd" className="text-xs">
                      ECD
                    </SelectItem>
                    <SelectItem value="ecf" className="text-xs">
                      ECF
                    </SelectItem>
                    <SelectItem value="efd_icms_ipi" className="text-xs">
                      EFD-ICMS/IPI
                    </SelectItem>
                    <SelectItem value="efd_contribuicoes" className="text-xs">
                      EFD-Contribuições
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] text-slate-500">Filtrar Status</Label>
                <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos" className="text-xs">
                      Todos os status
                    </SelectItem>
                    <SelectItem value="gerado" className="text-xs">
                      Gerado
                    </SelectItem>
                    <SelectItem value="validado" className="text-xs">
                      Validado
                    </SelectItem>
                    <SelectItem value="transmitido_manual" className="text-xs">
                      Transmitido
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1">
            {loading ? (
              <div className="p-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                Carregando arquivos de escrituração...
              </div>
            ) : arquivos.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <FileText className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-sm font-medium">
                  Nenhum arquivo SPED encontrado com os filtros atuais.
                </p>
                <p className="text-xs text-slate-400">
                  Preencha os campos ao lado para gerar o primeiro arquivo de escrituração contábil
                  ou fiscal.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto">
                {arquivos.map((arq) => (
                  <div
                    key={arq.id}
                    className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {getTipoBadge(arq.tipo)}
                        <span className="font-semibold text-slate-800 text-sm">
                          {arq.expand?.empresa?.nome_fantasia ||
                            arq.expand?.empresa?.razao_social ||
                            'Empresa'}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="font-mono font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                          Comp: {arq.competencia}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          (Leiaute {arq.versao_layout})
                        </span>
                        {getStatusBadge(arq.status)}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-slate-500 text-[11px]">
                        <span>
                          Linhas: <strong>{arq.total_linhas}</strong>
                        </span>
                        <span>
                          Tamanho:{' '}
                          <strong>{((arq.tamanho_bytes || 0) / 1024).toFixed(1)} KB</strong>
                        </span>
                        <span className="font-mono text-slate-600 bg-slate-100 px-1 rounded">
                          MD5: {arq.hash_md5.slice(0, 12)}...
                        </span>
                        <span>Gerado em: {new Date(arq.created).toLocaleDateString('pt-BR')}</span>
                        {arq.recibo_transmissao_pva && (
                          <span className="text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Recibo PVA: {arq.recibo_transmissao_pva}
                          </span>
                        )}
                      </div>

                      {/* Prévia de blocos gerados */}
                      {arq.resumo_blocos_json && Object.keys(arq.resumo_blocos_json).length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[10px] text-slate-400 font-medium">Blocos:</span>
                          {Object.entries(arq.resumo_blocos_json).map(([b, cnt]) => (
                            <span
                              key={b}
                              className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded border border-slate-200"
                            >
                              {b}: {cnt}
                            </span>
                          ))}
                        </div>
                      )}

                      {arq.observacoes && (
                        <p className="text-[11px] text-slate-500 italic truncate max-w-xl">
                          {arq.observacoes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => abrirVisualizador(arq)}
                        title="Ver linhas do SPED"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Visualizar</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1 text-blue-700 hover:text-blue-800 hover:bg-blue-50 border-blue-200"
                        onClick={() => spedService.downloadTxt(arq)}
                        title="Baixar arquivo .txt pronto para PVA"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Download .txt</span>
                      </Button>

                      {podeEditar && arq.status !== 'transmitido_manual' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1 text-slate-600 hover:text-emerald-700"
                          onClick={() => {
                            setArquivoParaTransmitir(arq)
                            setReciboPva(arq.recibo_transmissao_pva || '')
                            setObsPva(arq.observacoes || '')
                          }}
                          title="Atualizar status de transmissão"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Transmissão</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MODAL DE VISUALIZAÇÃO DE LINHAS DO SPED */}
      <Dialog
        open={!!visualizandoArquivo}
        onOpenChange={(open) => !open && setVisualizandoArquivo(null)}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="pb-2 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Visualizador de Registros SPED - {visualizandoArquivo?.tipo.toUpperCase()}
                </DialogTitle>
                <DialogDescription className="text-xs mt-1">
                  {visualizandoArquivo?.expand?.empresa?.nome_fantasia ||
                    visualizandoArquivo?.expand?.empresa?.razao_social}{' '}
                  • Competência: {visualizandoArquivo?.competencia} • Hash MD5:{' '}
                  <span className="font-mono">{visualizandoArquivo?.hash_md5}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* ESTATÍSTICAS DE BLOCOS */}
          {visualizandoArquivo?.resumo_blocos_json && (
            <div className="flex flex-wrap gap-2 py-2 text-xs">
              <span className="text-slate-500 font-medium py-1">Blocos compilados:</span>
              {Object.entries(visualizandoArquivo.resumo_blocos_json).map(([bloco, qtd]) => (
                <button
                  key={bloco}
                  type="button"
                  onClick={() => setFiltroBlocoLinha(filtroBlocoLinha === bloco ? 'todos' : bloco)}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition-colors border ${
                    filtroBlocoLinha === bloco
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  Bloco {bloco}: {qtd} regs
                </button>
              ))}
              {filtroBlocoLinha !== 'todos' && (
                <button
                  type="button"
                  onClick={() => setFiltroBlocoLinha('todos')}
                  className="text-xs text-blue-600 underline ml-2"
                >
                  Limpar filtro de bloco
                </button>
              )}
            </div>
          )}

          {/* VISUALIZADOR DE TEXTO MONOSPACED */}
          <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-100 p-4 rounded-lg font-mono text-xs max-h-[460px] border border-slate-800">
            {linhasFiltradas.length === 0 ? (
              <p className="text-slate-400 italic">Nenhum registro encontrado para este filtro.</p>
            ) : (
              linhasFiltradas.map((l, i) => (
                <div
                  key={i}
                  className="hover:bg-slate-900 py-0.5 px-1 rounded flex gap-4 leading-relaxed"
                >
                  <span className="text-slate-500 select-none w-10 text-right">{i + 1}</span>
                  <span className="text-emerald-400 select-all whitespace-pre-wrap break-all">
                    {l}
                  </span>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Exibindo {linhasFiltradas.length} de {linhasSped.length} linhas geradas
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setVisualizandoArquivo(null)}>
                Fechar
              </Button>
              {visualizandoArquivo && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                  onClick={() => spedService.downloadTxt(visualizandoArquivo)}
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar .txt
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE ATUALIZAÇÃO DE TRANSMISSÃO PVA */}
      <Dialog
        open={!!arquivoParaTransmitir}
        onOpenChange={(open) => !open && setArquivoParaTransmitir(null)}
      >
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" />
              Controle de Transmissão PVA / RFB
            </DialogTitle>
            <DialogDescription className="text-xs">
              Após importar o arquivo .txt no validador da Receita Federal e assinar com o e-CNPJ,
              registre aqui o número do recibo oficial para auditoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Número do Recibo de Transmissão (PVA)</Label>
              <Input
                placeholder="Ex: 88.34.12.90.11.23.45.67-8"
                value={reciboPva}
                onChange={(e) => setReciboPva(e.target.value)}
                className="h-9 font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notas e Observações da Transmissão</Label>
              <Input
                placeholder="Ex: Transmitido com sucesso via PVA ECD v10.0.1 pelo e-CNPJ A1."
                value={obsPva}
                onChange={(e) => setObsPva(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setArquivoParaTransmitir(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleSalvarTransmissao}
            >
              Confirmar Transmissão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

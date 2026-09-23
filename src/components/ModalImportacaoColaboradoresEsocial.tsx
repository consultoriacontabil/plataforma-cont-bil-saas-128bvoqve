import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  esocialImportService,
  type ColaboradorImportItem,
  type PreviaImportacaoColaboradores,
  type RegraDuplicidade,
} from '@/services/esocialImport'
import { esocialService } from '@/services/esocial'
import { certificadosService, type CertificadoSaudeInfo } from '@/services/certificados'
import { maskCpf, formatDatePtBr } from '@/lib/formatters'
import type { Empresa, EsocialConfigRecord } from '@/types'
import {
  UploadCloud,
  FileCode2,
  FileSpreadsheet,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  ExternalLink,
  Info,
  Building2,
  Trash2,
  Users2,
  Loader2,
  Check,
  Plus,
} from 'lucide-react'

interface ModalImportacaoColaboradoresEsocialProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  usuarioId: string
  empresas: Empresa[]
  empresaInicialId?: string
  onImportConcluido?: () => void
}

export function ModalImportacaoColaboradoresEsocial({
  open,
  onOpenChange,
  tenantId,
  usuarioId,
  empresas,
  empresaInicialId,
  onImportConcluido,
}: ModalImportacaoColaboradoresEsocialProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Empresa selecionada
  const [empresaId, setEmpresaId] = useState<string>('')

  // Aba ativa: 'upload' ou 'supervisao'
  const [viaAtiva, setViaAtiva] = useState<'upload' | 'supervisao'>('upload')

  // Estado do Arquivo
  const [arquivoNome, setArquivoNome] = useState<string>('')
  const [arquivoTamanho, setArquivoTamanho] = useState<string>('')
  const [carregandoArquivo, setCarregandoArquivo] = useState(false)

  // Prévia e Validações
  const [previa, setPrevia] = useState<PreviaImportacaoColaboradores | null>(null)
  const [regraDuplicidadeGeral, setRegraDuplicidadeGeral] = useState<RegraDuplicidade>('atualizar')
  const [filtroStatusPrevia, setFiltroStatusPrevia] = useState<
    'todos' | 'valido' | 'duplicado' | 'erro'
  >('todos')
  const [executandoImportacao, setExecutandoImportacao] = useState(false)

  // Estado do Modo Supervisão
  const [esocialConfig, setEsocialConfig] = useState<EsocialConfigRecord | null>(null)
  const [saudeCertificado, setSaudeCertificado] = useState<CertificadoSaudeInfo | null>(null)
  const [carregandoSupervisao, setCarregandoSupervisao] = useState(false)

  // Formulário do Assistido Manual em Modo Supervisão
  const [supNome, setSupNome] = useState('')
  const [supCpf, setSupCpf] = useState('')
  const [supCargo, setSupCargo] = useState('')
  const [supSalario, setSupSalario] = useState('')
  const [supAdmissao, setSupAdmissao] = useState(new Date().toISOString().slice(0, 10))
  const [supCbo, setSupCbo] = useState('')
  const [supPis, setSupPis] = useState('')
  const [supMatricula, setSupMatricula] = useState('')

  // Inicializar empresa selecionada
  useEffect(() => {
    if (open) {
      if (empresaInicialId && empresaInicialId !== 'todas') {
        setEmpresaId(empresaInicialId)
      } else if (empresas.length > 0) {
        setEmpresaId(empresas[0].id)
      }
    }
  }, [open, empresaInicialId, empresas])

  // Carregar status do certificado e eSocial quando seleciona empresa ou entra na aba supervisão
  useEffect(() => {
    if (!open || !empresaId || !tenantId) return

    let isMounted = true
    const carregarConfigSupervisao = async () => {
      setCarregandoSupervisao(true)
      try {
        const [cfg, certs] = await Promise.all([
          esocialService.getConfig(tenantId, empresaId),
          certificadosService.listByEmpresa(empresaId),
        ])

        if (!isMounted) return

        setEsocialConfig(cfg)
        const certA1 = certs.find((c) => c.tipo === 'a1') || certs[0] || null
        const saude = certificadosService.calcularSaude(certA1)
        setSaudeCertificado(saude)
      } catch (err) {
        console.warn('Erro ao carregar configurações de supervisão:', err)
      } finally {
        if (isMounted) setCarregandoSupervisao(false)
      }
    }

    carregarConfigSupervisao()
    return () => {
      isMounted = false
    }
  }, [open, empresaId, tenantId])

  // Empresa selecionada atual
  const empresaSelecionada = useMemo(() => {
    return empresas.find((e) => e.id === empresaId) || null
  }, [empresas, empresaId])

  // Resetar estado quando fechar
  const handleClose = () => {
    onOpenChange(false)
    setTimeout(() => {
      setPrevia(null)
      setArquivoNome('')
      setArquivoTamanho('')
      setSupNome('')
      setSupCpf('')
      setSupCargo('')
      setSupSalario('')
      setSupCbo('')
      setSupPis('')
      setSupMatricula('')
    }, 200)
  }

  // Processar Upload de Arquivo
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCarregandoArquivo(true)
    setArquivoNome(file.name)
    const kb = (file.size / 1024).toFixed(1)
    setArquivoTamanho(`${kb} KB`)

    try {
      const text = await file.text()
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      let itensLidos: ColaboradorImportItem[] = []

      if (ext === 'xml') {
        itensLidos = esocialImportService.parseXmlEsocial(text)
      } else if (ext === 'json') {
        itensLidos = esocialImportService.parseJsonText(text)
      } else if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
        itensLidos = esocialImportService.parseCsvColaboradores(text)
      } else {
        throw new Error(
          'Extensão de arquivo não suportada. Envie um arquivo .XML (S-2200/S-2199), .CSV ou .JSON.',
        )
      }

      if (itensLidos.length === 0) {
        throw new Error('Nenhum vínculo de colaborador foi identificado no arquivo fornecido.')
      }

      // Executar validação contra os registros existentes na empresa
      const previaValidada = await esocialImportService.validarListaColaboradores({
        tenantId,
        empresaId,
        itens: itensLidos,
        regraPadraoDuplicidade: regraDuplicidadeGeral,
      })

      setPrevia(previaValidada)
      toast({
        title: 'Arquivo processado com sucesso',
        description: `${previaValidada.total} colaborador(es) localizado(s) no arquivo.`,
      })
    } catch (err: unknown) {
      console.error('Erro no parse do arquivo:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao processar arquivo.'
      toast({
        variant: 'destructive',
        title: 'Erro no arquivo',
        description: msg,
      })
      setPrevia(null)
    } finally {
      setCarregandoArquivo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Alterar ação de duplicidade de um item específico na prévia
  const handleMudarAcaoItem = (idTemp: string, acao: 'atualizar' | 'pular') => {
    if (!previa) return
    const novosItens = previa.itens.map((item) => {
      if (item.id_temp === idTemp) {
        return { ...item, acao_duplicidade: acao }
      }
      return item
    })
    setPrevia({ ...previa, itens: novosItens })
  }

  // Alterar ação de duplicidade geral
  const handleMudarAcaoGeral = (acao: RegraDuplicidade) => {
    setRegraDuplicidadeGeral(acao)
    if (!previa) return
    const novosItens = previa.itens.map((item) => ({
      ...item,
      acao_duplicidade: acao,
    }))
    setPrevia({ ...previa, itens: novosItens })
  }

  // Remover item da prévia
  const handleRemoverItemPrevia = (idTemp: string) => {
    if (!previa) return
    const novosItens = previa.itens.filter((i) => i.id_temp !== idTemp)
    const validos = novosItens.filter((i) => i.status_validacao === 'valido').length
    const duplicados = novosItens.filter((i) => i.status_validacao === 'duplicado').length
    const erros = novosItens.filter((i) => i.status_validacao === 'erro').length

    setPrevia({
      itens: novosItens,
      total: novosItens.length,
      validos,
      duplicados,
      erros,
    })
  }

  // Adicionar colaborador assistido manualmente pela via de Supervisão
  const handleAdicionarSupervisaoManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supNome.trim() || !supCpf.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Nome completo e CPF são obrigatórios.',
      })
      return
    }

    const salarioNum = parseFloat(supSalario.replace(',', '.')) || 0

    const novoItem: ColaboradorImportItem = {
      id_temp: `sup-${Date.now()}`,
      nome_completo: supNome.trim(),
      cpf: supCpf.replace(/\D/g, ''),
      cargo: supCargo.trim() || 'Colaborador',
      salario: salarioNum,
      data_admissao: supAdmissao,
      tipo: 'clt',
      status: 'ativo',
      cbo: supCbo.trim() || undefined,
      nis_pis: supPis.replace(/\D/g, '') || undefined,
      matricula_esocial: supMatricula.trim() || undefined,
      origem: 'supervisao_esocial',
      status_validacao: 'valido',
      erros: [],
      avisos: [],
    }

    // Valida com o serviço
    const lista = previa ? [...previa.itens, novoItem] : [novoItem]
    const previaValidada = await esocialImportService.validarListaColaboradores({
      tenantId,
      empresaId,
      itens: lista,
      regraPadraoDuplicidade: regraDuplicidadeGeral,
    })

    setPrevia(previaValidada)
    setSupNome('')
    setSupCpf('')
    setSupCargo('')
    setSupSalario('')
    setSupCbo('')
    setSupPis('')
    setSupMatricula('')

    toast({
      title: 'Vínculo adicionado à prévia',
      description: `${novoItem.nome_completo} incluído na fila de importação supervisionada.`,
    })
  }

  // Confirmar e Executar Importação
  const handleConfirmarImportacao = async () => {
    if (!previa || previa.itens.length === 0) return
    if (!empresaId) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma empresa',
        description: 'É necessário vincular os colaboradores a uma empresa.',
      })
      return
    }

    setExecutandoImportacao(true)
    try {
      const res = await esocialImportService.executarImportacao({
        tenantId,
        empresaId,
        usuarioId,
        itens: previa.itens,
        regraDuplicidadeGeral,
      })

      if (res.sucesso || res.criados > 0 || res.atualizados > 0) {
        toast({
          title: 'Importação e-Social concluída!',
          description: `${res.criados} colaborador(es) cadastrado(s), ${res.atualizados} atualizado(s) e ${res.ignorados} ignorado(s).`,
        })
        if (onImportConcluido) {
          onImportConcluido()
        }
        handleClose()
      } else {
        toast({
          variant: 'destructive',
          title: 'Falha na importação',
          description: res.falhas[0]?.motivo || 'Nenhum registro pôde ser salvo.',
        })
      }
    } catch (err: unknown) {
      console.error('Erro executando importação:', err)
      const msg = err instanceof Error ? err.message : 'Falha na comunicação com o servidor.'
      toast({
        variant: 'destructive',
        title: 'Erro na importação',
        description: msg,
      })
    } finally {
      setExecutandoImportacao(false)
    }
  }

  // Itens filtrados para exibição na tabela da prévia
  const itensExibidos = useMemo(() => {
    if (!previa) return []
    if (filtroStatusPrevia === 'todos') return previa.itens
    return previa.itens.filter((i) => i.status_validacao === filtroStatusPrevia)
  }, [previa, filtroStatusPrevia])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden border-[#E2E8F0]">
        {/* Cabeçalho */}
        <DialogHeader className="p-5 pb-4 border-b border-slate-100 bg-[#F8FAFC]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-[#0FA3A3]">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-bold text-[#1A2333]">
                    Importar Colaboradores via e-Social
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className="border-teal-200 text-[#0FA3A3] text-[10px] font-semibold"
                  >
                    e-Social S-2200 / S-2199
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-[#64748B]">
                  Importe o quadro de funcionários a partir de XMLs oficiais do e-Social, planilhas
                  ou consulta assistida.
                </DialogDescription>
              </div>
            </div>

            {/* Seletor de Empresa Alvo */}
            <div className="flex items-center gap-2 shrink-0">
              <Building2 className="h-4 w-4 text-[#64748B]" />
              <div className="w-56">
                <Select
                  value={empresaId}
                  onValueChange={(val) => {
                    setEmpresaId(val)
                    setPrevia(null) // Revalidar se mudar a empresa
                  }}
                >
                  <SelectTrigger className="h-8 text-xs rounded-xl border-[#E2E8F0] bg-white">
                    <SelectValue placeholder="Empresa destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.nome_fantasia || emp.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo com Tabs de Entrada */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!previa ? (
            <Tabs
              value={viaAtiva}
              onValueChange={(v) => setViaAtiva(v as 'upload' | 'supervisao')}
              className="space-y-4"
            >
              <TabsList className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl h-10">
                <TabsTrigger value="upload" className="gap-2 text-xs font-semibold rounded-lg">
                  <FileCode2 className="h-4 w-4 text-[#0FA3A3]" />
                  <span>Via A: Upload de Arquivo</span>
                </TabsTrigger>
                <TabsTrigger value="supervisao" className="gap-2 text-xs font-semibold rounded-lg">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  <span>Via B: Consulta e-Social (Supervisão)</span>
                </TabsTrigger>
              </TabsList>

              {/* VIA A: Upload de Arquivo */}
              <TabsContent value="upload" className="space-y-4 m-0">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-[#0FA3A3] hover:bg-slate-50/50 transition-all rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xml,.json,.csv,.tsv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-[#0FA3A3] group-hover:scale-105 transition-transform mb-3">
                    {carregandoArquivo ? (
                      <Loader2 className="h-7 w-7 animate-spin" />
                    ) : (
                      <UploadCloud className="h-7 w-7" />
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-[#1A2333]">
                    Clique para selecionar ou arraste o arquivo aqui
                  </h4>
                  <p className="text-xs text-[#64748B] mt-1 max-w-md">
                    Formatos suportados: <strong>XML oficial do e-Social</strong> (S-2200 Admissão,
                    S-2199 Cad. Inicial ou S-2300), planilha <strong>CSV/TSV</strong> ou{' '}
                    <strong>JSON</strong> de exportação do sistema anterior.
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-[11px] text-[#64748B]">
                    <span className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200">
                      <FileCode2 className="h-3.5 w-3.5 text-teal-600" /> .XML S-2200
                    </span>
                    <span className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> .CSV Planilha
                    </span>
                    <span className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200">
                      <FileJson className="h-3.5 w-3.5 text-amber-600" /> .JSON Dados
                    </span>
                  </div>
                </div>

                {/* Orientações sobre mapeamento automático */}
                <div className="rounded-xl bg-blue-50/60 border border-blue-100 p-3.5 text-xs text-[#1E293B] flex items-start gap-3">
                  <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-blue-900">Mapeamento Inteligente e-Social</p>
                    <p className="text-blue-800/90 text-[11px] leading-relaxed">
                      O leitor reconhece automaticamente CPF, Nome, NIS/PIS, CTPS, Matrícula
                      interna, Salário base, Data de Admissão, CBO do cargo e Dependentes IRRF. Os
                      dados serão validados contra o quadro da empresa antes de qualquer gravação.
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* VIA B: Consulta e-Social (Modo Supervisão) */}
              <TabsContent value="supervisao" className="space-y-4 m-0">
                {/* Banner Oficial de Modo Supervisão (Princípio de Honestidade Técnica) */}
                <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                      <span className="font-bold text-amber-900 text-xs">
                        Modo Supervisão Ativo (Princípio da Honestidade Técnica)
                      </span>
                    </div>
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-semibold gap-1">
                      <ShieldAlert className="h-3 w-3 text-amber-600" />
                      Supervisão Ativa
                    </Badge>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    A sincronização direta por webservice com a base governamental do e-Social exige
                    conexão mTLS com Certificado A1 e credenciais governamentais ativas.{' '}
                    <strong>
                      A plataforma Rumo nunca simula retornos governamentais falsos.
                    </strong>{' '}
                    Enquanto o canal direto estiver em homologação, utilize o assistente
                    supervisionado abaixo ou carregue os arquivos XML recebidos no portal oficial do
                    e-Social.
                  </p>
                </div>

                {/* Diagnóstico do Certificado Digital da Empresa */}
                <Card className="rounded-xl border-[#E2E8F0] shadow-none bg-slate-50/50">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-[#0FA3A3]" />
                        <span className="text-xs font-bold text-[#1A2333]">
                          Certificado Digital da Empresa
                        </span>
                      </div>
                      {saudeCertificado && saudeCertificado.saude === 'valido' ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          {saudeCertificado.label} ({saudeCertificado.diasRestantes}d restantes)
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-200 text-amber-700 text-[10px] font-semibold gap-1"
                        >
                          <AlertTriangle className="h-3 w-3 text-amber-600" />
                          {saudeCertificado?.label || 'Sem Certificado A1'}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                          Empresa
                        </span>
                        <span className="font-semibold text-[#1A2333] truncate block">
                          {empresaSelecionada?.razao_social || '—'}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                          CNPJ Empregador
                        </span>
                        <span className="font-mono text-[#1A2333] font-semibold block">
                          {empresaSelecionada?.cnpj || '—'}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                          Ambiente
                        </span>
                        <span className="font-semibold text-[#1A2333] block">
                          {esocialConfig?.ambiente === 'producao'
                            ? 'Produção Geral'
                            : 'Produção Restrita (Supervisão)'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Formulário Assistido de Inclusão Supervisionada */}
                <form
                  onSubmit={handleAdicionarSupervisaoManual}
                  className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h5 className="text-xs font-bold text-[#1A2333] flex items-center gap-1.5">
                      <Users2 className="h-3.5 w-3.5 text-[#0FA3A3]" />
                      Adicionar Vínculo e-Social Manualmente
                    </h5>
                    <span className="text-[10px] text-[#64748B]">
                      Alimenta a fila de importação e validação
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-[11px] font-semibold text-[#475569]">
                        Nome Completo *
                      </Label>
                      <Input
                        value={supNome}
                        onChange={(e) => setSupNome(e.target.value)}
                        placeholder="Ex: Carlos Eduardo da Silva"
                        className="h-8 text-xs rounded-lg border-slate-200"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#475569]">CPF *</Label>
                      <Input
                        value={supCpf}
                        onChange={(e) => setSupCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        className="h-8 text-xs rounded-lg border-slate-200 font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#475569]">Cargo *</Label>
                      <Input
                        value={supCargo}
                        onChange={(e) => setSupCargo(e.target.value)}
                        placeholder="Ex: Assistente Administrativo"
                        className="h-8 text-xs rounded-lg border-slate-200"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#475569]">
                        Salário Base (R$) *
                      </Label>
                      <Input
                        value={supSalario}
                        onChange={(e) => setSupSalario(e.target.value)}
                        placeholder="Ex: 3500,00"
                        className="h-8 text-xs rounded-lg border-slate-200 font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#475569]">
                        Data de Admissão
                      </Label>
                      <Input
                        type="date"
                        value={supAdmissao}
                        onChange={(e) => setSupAdmissao(e.target.value)}
                        className="h-8 text-xs rounded-lg border-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#475569]">
                        CBO (Opcional)
                      </Label>
                      <Input
                        value={supCbo}
                        onChange={(e) => setSupCbo(e.target.value)}
                        placeholder="Ex: 4110-10"
                        className="h-8 text-xs rounded-lg border-slate-200 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#475569]">
                        PIS / NIS (Opcional)
                      </Label>
                      <Input
                        value={supPis}
                        onChange={(e) => setSupPis(e.target.value)}
                        placeholder="Ex: 123.45678.90-1"
                        className="h-8 text-xs rounded-lg border-slate-200 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#475569]">
                        Matrícula e-Social (Opcional)
                      </Label>
                      <Input
                        value={supMatricula}
                        onChange={(e) => setSupMatricula(e.target.value)}
                        placeholder="Ex: MATR-001"
                        className="h-8 text-xs rounded-lg border-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      size="sm"
                      className="gap-1.5 h-8 text-xs bg-[#0FA3A3] text-white hover:bg-[#0C8585] rounded-lg"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Incluir na Fila de Prévia</span>
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          ) : (
            /* PRÉVIA DE IMPORTAÇÃO COM CONTADORES E ANTI-DUPLICIDADE */
            <div className="space-y-4">
              {/* Barra de Contadores e Status */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="rounded-xl border-slate-200 bg-white">
                  <CardContent className="p-3">
                    <span className="text-[10px] uppercase font-bold text-[#64748B]">
                      Total no Lote
                    </span>
                    <p className="text-xl font-bold text-[#1A2333] mt-0.5">{previa.total}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-xl border-emerald-200 bg-emerald-50/50">
                  <CardContent className="p-3">
                    <span className="text-[10px] uppercase font-bold text-emerald-800">
                      Prontos para Criar
                    </span>
                    <p className="text-xl font-bold text-emerald-700 mt-0.5">{previa.validos}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-xl border-amber-200 bg-amber-50/50">
                  <CardContent className="p-3">
                    <span className="text-[10px] uppercase font-bold text-amber-800">
                      Já Cadastrados (Duplicados)
                    </span>
                    <p className="text-xl font-bold text-amber-700 mt-0.5">{previa.duplicados}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-xl border-rose-200 bg-rose-50/50">
                  <CardContent className="p-3">
                    <span className="text-[10px] uppercase font-bold text-rose-800">
                      Erros Impeditivos
                    </span>
                    <p className="text-xl font-bold text-rose-700 mt-0.5">{previa.erros}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Controles de Regra de Anti-duplicidade e Filtro */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold text-[#475569]">
                      Se CPF já existir:
                    </Label>
                    <Select
                      value={regraDuplicidadeGeral}
                      onValueChange={(val: RegraDuplicidade) => handleMudarAcaoGeral(val)}
                    >
                      <SelectTrigger className="h-8 w-44 text-xs rounded-lg bg-white border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="atualizar">Atualizar dados existentes</SelectItem>
                        <SelectItem value="pular">Pular (manter original)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filtro de exibição */}
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFiltroStatusPrevia('todos')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        filtroStatusPrevia === 'todos'
                          ? 'bg-[#0FA3A3] text-white'
                          : 'text-[#64748B] hover:text-[#1A2333]'
                      }`}
                    >
                      Todos ({previa.total})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroStatusPrevia('valido')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        filtroStatusPrevia === 'valido'
                          ? 'bg-emerald-600 text-white'
                          : 'text-[#64748B] hover:text-[#1A2333]'
                      }`}
                    >
                      Válidos ({previa.validos})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroStatusPrevia('duplicado')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        filtroStatusPrevia === 'duplicado'
                          ? 'bg-amber-600 text-white'
                          : 'text-[#64748B] hover:text-[#1A2333]'
                      }`}
                    >
                      Duplicados ({previa.duplicados})
                    </button>
                    {previa.erros > 0 && (
                      <button
                        type="button"
                        onClick={() => setFiltroStatusPrevia('erro')}
                        className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                          filtroStatusPrevia === 'erro'
                            ? 'bg-rose-600 text-white'
                            : 'text-[#64748B] hover:text-[#1A2333]'
                        }`}
                      >
                        Erros ({previa.erros})
                      </button>
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPrevia(null)}
                  className="h-8 text-xs border-slate-200 hover:bg-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                  Carregar Outro Arquivo
                </Button>
              </div>

              {/* Tabela de Prévia dos Colaboradores */}
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Colaborador / CPF</th>
                        <th className="py-2.5 px-3">Cargo & CBO</th>
                        <th className="py-2.5 px-3">Admissão</th>
                        <th className="py-2.5 px-3">Salário</th>
                        <th className="py-2.5 px-3">Diagnóstico</th>
                        <th className="py-2.5 px-3">Ação Anti-duplicidade</th>
                        <th className="py-2.5 px-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[#1A2333]">
                      {itensExibidos.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-[#94A3B8]">
                            Nenhum colaborador nesta categoria.
                          </td>
                        </tr>
                      ) : (
                        itensExibidos.map((item) => (
                          <tr key={item.id_temp} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3">
                              <p className="font-bold text-[#1A2333]">
                                {item.nome_completo || '—'}
                              </p>
                              <p className="text-[11px] text-[#64748B] font-mono">
                                CPF: {maskCpf(item.cpf) || 'Ausente'}
                              </p>
                            </td>
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-[#1A2333]">{item.cargo}</p>
                              {item.cbo && (
                                <span className="text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded font-mono inline-block mt-0.5">
                                  CBO: {item.cbo}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[#64748B]">
                              {item.data_admissao ? formatDatePtBr(item.data_admissao) : '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-[#1A2333]">
                              R$ {item.salario.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3">
                              {item.status_validacao === 'valido' && (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Válido
                                </Badge>
                              )}
                              {item.status_validacao === 'duplicado' && (
                                <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-semibold gap-1">
                                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                                  Já Cadastrado
                                </Badge>
                              )}
                              {item.status_validacao === 'erro' && (
                                <div className="space-y-0.5">
                                  <Badge className="bg-rose-50 text-rose-800 border-rose-200 text-[10px] font-semibold gap-1">
                                    <XCircle className="h-3 w-3 text-rose-600" />
                                    Erro
                                  </Badge>
                                  <p className="text-[10px] text-rose-600 max-w-xs">
                                    {item.erros.join(', ')}
                                  </p>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {item.status_validacao === 'duplicado' ? (
                                <Select
                                  value={item.acao_duplicidade || 'atualizar'}
                                  onValueChange={(v: 'atualizar' | 'pular') =>
                                    handleMudarAcaoItem(item.id_temp, v)
                                  }
                                >
                                  <SelectTrigger className="h-7 w-32 text-[11px] rounded border-slate-200">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="atualizar" className="text-xs">
                                      Atualizar
                                    </SelectItem>
                                    <SelectItem value="pular" className="text-xs">
                                      Pular
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-[11px] text-[#94A3B8]">Novo cadastro</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoverItemPrevia(item.id_temp)}
                                className="h-6 w-6 p-0 text-[#94A3B8] hover:text-rose-600"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Ações */}
        <DialogFooter className="p-4 border-t border-slate-100 bg-[#F8FAFC] flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-xs text-[#64748B]">
            {arquivoNome && (
              <span className="flex items-center gap-1.5 font-medium text-[#1A2333]">
                <FileCode2 className="h-3.5 w-3.5 text-[#0FA3A3]" />
                {arquivoNome} ({arquivoTamanho})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={executandoImportacao}
              className="h-9 text-xs rounded-xl border-[#E2E8F0]"
            >
              Cancelar
            </Button>

            {previa && (
              <Button
                size="sm"
                onClick={handleConfirmarImportacao}
                disabled={
                  executandoImportacao ||
                  previa.total === 0 ||
                  (previa.validos === 0 && previa.duplicados === 0)
                }
                className="gap-2 h-9 text-xs font-semibold rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585]"
              >
                {executandoImportacao ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>
                      Confirmar Importação (
                      {previa.validos +
                        (regraDuplicidadeGeral === 'atualizar' ? previa.duplicados : 0)}
                      )
                    </span>
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

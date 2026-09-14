import React, { useState, useRef, useMemo } from 'react'
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Loader2,
  FileText,
  Building2,
  SlidersHorizontal,
  Check,
  X,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  FileKey2,
  HelpCircle,
  Info,
  Trash2,
} from 'lucide-react'
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
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { maskCnpj } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'
import {
  COLUNAS_SUPORTADAS,
  gerarCsvModelo,
  parseCsvText,
  detectarMapeamentoAutomatico,
  validarLinhasMigracao,
  type LinhaPreviaValidada,
} from '@/lib/migracaoPlanilha'
import {
  migracoesService,
  type EmpresaMigracaoLinhaItem,
  type ExecutarMigracaoResult,
  type CertificadoVinculadoArquivo,
} from '@/services/migracoesService'

interface ModalImportacaoEmpresasProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  onImportacaoSucesso: () => void
}

type EtapaWizard =
  | 'modelo_upload' // Etapa 1 e 2: Baixar modelo e Upload drag-and-drop
  | 'mapeamento' // Etapa 3: Mapeamento de colunas com auto-detecção
  | 'validacao' // Etapa 4: Prévia com validação linha a linha
  | 'certificados' // Etapa 5: Anexo de Certificados Digitais e-CNPJ A1 (.pfx)
  | 'relatorio' // Etapa 6: Execução com anti-duplicidade e relatório final

export function ModalImportacaoEmpresas({
  open,
  onOpenChange,
  tenantId,
  onImportacaoSucesso,
}: ModalImportacaoEmpresasProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const certFileInputRef = useRef<HTMLInputElement>(null)

  const [etapa, setEtapa] = useState<EtapaWizard>('modelo_upload')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [lendoArquivo, setLendoArquivo] = useState(false)

  // Dados brutos da planilha
  const [cabecalhosArquivo, setCabecalhosArquivo] = useState<string[]>([])
  const [linhasBrutas, setLinhasBrutas] = useState<string[][]>([])

  // Mapeamento: Coluna do arquivo -> Chave da Empresa
  const [mapeamento, setMapeamento] = useState<Record<string, keyof EmpresaMigracaoLinhaItem | ''>>(
    {},
  )

  // Anti-duplicidade: 'atualizar' ou 'pular'
  const [modoDuplicidade, setModoDuplicidade] = useState<'atualizar' | 'pular'>('atualizar')

  // Certificados digitais anexados para migração
  const [certificadosAnexados, setCertificadosAnexados] = useState<CertificadoVinculadoArquivo[]>(
    [],
  )

  // Execução
  const [executando, setExecutando] = useState(false)
  const [resultadoMigracao, setResultadoMigracao] = useState<ExecutarMigracaoResult | null>(null)

  // Reset do formulário ao fechar
  const resetar = () => {
    setEtapa('modelo_upload')
    setArquivo(null)
    setNomeArquivo('')
    setLendoArquivo(false)
    setCabecalhosArquivo([])
    setLinhasBrutas([])
    setMapeamento({})
    setModoDuplicidade('atualizar')
    setCertificadosAnexados([])
    setExecutando(false)
    setResultadoMigracao(null)
  }

  // 1. Download do modelo CSV
  const handleDownloadModelo = () => {
    const csvContent = gerarCsvModelo()
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'modelo_migracao_empresas_rumo.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'Modelo de migração baixado!',
      description: 'Preencha a planilha CSV com as empresas do sistema anterior.',
    })
  }

  // 2. Leitura de arquivo
  const handleProcessarArquivo = async (file: File) => {
    setNomeArquivo(file.name)
    setArquivo(file)
    setLendoArquivo(true)

    try {
      const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

      if (isXlsx) {
        // Envia para o backend para converter em Markdown tabular via $documents.toMarkdown
        const formData = new FormData()
        formData.append('arquivo', file)

        let parsedFromDoc = false
        try {
          const data = await pb.send<{ markdown?: string }>(
            '/backend/v1/documentos/extrair-empresa',
            {
              method: 'POST',
              body: formData,
            },
          )
          if (data && data.markdown) {
            const { cabecalhos, linhas } = parseCsvText(data.markdown)
            if (cabecalhos.length > 0 && linhas.length > 0) {
              setCabecalhosArquivo(cabecalhos)
              setLinhasBrutas(linhas)
              const autoMap = detectarMapeamentoAutomatico(cabecalhos)
              setMapeamento(autoMap)
              setEtapa('mapeamento')
              parsedFromDoc = true
            }
          }
        } catch (docErr) {
          console.warn('Fallback para leitura de texto no XLSX:', docErr)
        }

        if (!parsedFromDoc) {
          toast({
            variant: 'destructive',
            title: 'Formato recomendado: CSV',
            description:
              'Para garantir máxima fidelidade nas colunas de migração, exporte seu arquivo como CSV (separado por ponto e vírgula ou vírgula).',
          })
        }
      } else {
        // Arquivo CSV / TSV / TXT
        const text = await file.text()
        const { cabecalhos, linhas } = parseCsvText(text)

        if (cabecalhos.length === 0 || linhas.length === 0) {
          toast({
            variant: 'destructive',
            title: 'Arquivo vazio ou sem cabeçalhos',
            description:
              'Certifique-se de que a planilha contenha uma linha de títulos e ao menos 1 empresa.',
          })
          setLendoArquivo(false)
          return
        }

        setCabecalhosArquivo(cabecalhos)
        setLinhasBrutas(linhas)

        // Detecção automática de mapeamento
        const autoMap = detectarMapeamentoAutomatico(cabecalhos)
        setMapeamento(autoMap)
        setEtapa('mapeamento')

        toast({
          title: `${linhas.length} empresas identificadas!`,
          description: 'Revise o mapeamento das colunas detectadas.',
        })
      }
    } catch (err: unknown) {
      console.error('Erro na leitura da planilha:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao ler arquivo',
        description: 'Não foi possível interpretar a estrutura do arquivo.',
      })
    } finally {
      setLendoArquivo(false)
    }
  }

  // 3. Linhas validadas na etapa 4
  const linhasValidadas: LinhaPreviaValidada[] = useMemo(() => {
    if (cabecalhosArquivo.length === 0 || linhasBrutas.length === 0) return []
    return validarLinhasMigracao(cabecalhosArquivo, linhasBrutas, mapeamento)
  }, [cabecalhosArquivo, linhasBrutas, mapeamento])

  // Empresas aptas (válidas ou com aviso)
  const empresasAptas = useMemo(() => {
    return linhasValidadas.filter((l) => l.status !== 'erro' && l.dados.cnpj)
  }, [linhasValidadas])

  // Processamento de múltiplos arquivos .pfx/.p12 com associação inteligente
  const handleUploadCertificadosMultiplos = (files: FileList | File[]) => {
    const novos: CertificadoVinculadoArquivo[] = []
    const cleanCnpjsDisponiveis = empresasAptas.map((e) => ({
      clean: (e.dados.cnpj || '').replace(/\D/g, ''),
      razao: e.dados.razao_social || '',
      item: e,
    }))

    Array.from(files).forEach((file) => {
      const nome = file.name
      // Extrair dígitos de CNPJ no nome do arquivo (ex: "empresa_12345678000190.pfx" ou "12.345.678_0001-90.p12")
      const digitosNome = nome.replace(/\D/g, '')

      let associadoCnpj = ''
      let emissorDetectado = ''
      let serieDetectada = ''
      let validadeDetectada = ''

      // Tenta achar um CNPJ da lista contido nos dígitos do nome
      const matchEmpresa = cleanCnpjsDisponiveis.find(
        (e) => digitosNome.includes(e.clean) || e.clean.includes(digitosNome),
      )

      if (matchEmpresa) {
        associadoCnpj = matchEmpresa.clean
        emissorDetectado = matchEmpresa.item.dados.certificado_emissor || ''
        serieDetectada = matchEmpresa.item.dados.certificado_serie || ''
        validadeDetectada = matchEmpresa.item.dados.certificado_validade || ''
      }

      novos.push({
        arquivo: file,
        nomeArquivo: nome,
        tamanho: file.size,
        cnpjAssociado: associadoCnpj,
        emissor: emissorDetectado,
        serie: serieDetectada,
        validade: validadeDetectada,
      })
    })

    setCertificadosAnexados((prev) => [...prev, ...novos])

    const associadosAuto = novos.filter((c) => c.cnpjAssociado).length
    toast({
      title: `${novos.length} certificado(s) A1 adicionado(s)!`,
      description:
        associadosAuto > 0
          ? `${associadosAuto} associado(s) automaticamente pelo CNPJ no nome do arquivo.`
          : 'Selecione a qual empresa cada certificado pertence.',
    })
  }

  const totalComErros = linhasValidadas.filter((l) => l.status === 'erro').length
  const totalComAvisos = linhasValidadas.filter((l) => l.status === 'aviso').length
  const totalValidas = linhasValidadas.filter((l) => l.status === 'valido').length

  // 4. Executar importação no backend
  const handleExecutarMigracao = async () => {
    if (!tenantId) return
    setExecutando(true)

    const empresasValidasParaEnvio: EmpresaMigracaoLinhaItem[] = linhasValidadas
      .filter((l) => l.status !== 'erro')
      .map((l) => ({
        linha: l.linhaNumero,
        razao_social: l.dados.razao_social || '',
        nome_fantasia: l.dados.nome_fantasia,
        cnpj: l.dados.cnpj || '',
        inscricao_estadual: l.dados.inscricao_estadual,
        inscricao_municipal: l.dados.inscricao_municipal,
        regime_tributario: l.dados.regime_tributario,
        porte: l.dados.porte,
        data_abertura: l.dados.data_abertura,
        cnae: l.dados.cnae,
        natureza_juridica: l.dados.natureza_juridica,
        cep: l.dados.cep,
        logradouro: l.dados.logradouro,
        numero: l.dados.numero,
        complemento: l.dados.complemento,
        bairro: l.dados.bairro,
        cidade: l.dados.cidade,
        uf: l.dados.uf,
        email: l.dados.email,
        telefone: l.dados.telefone,
        site: l.dados.site,
        socios: l.dados.socios,
        honorarios_mensais: l.dados.honorarios_mensais,
        certificado_validade: l.dados.certificado_validade,
        certificado_emissor: l.dados.certificado_emissor,
        certificado_serie: l.dados.certificado_serie,
        observacoes: l.dados.observacoes,
      }))

    if (empresasValidasParaEnvio.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhuma linha válida',
        description: 'Corrija os erros nas colunas obrigatórias antes de importar.',
      })
      setExecutando(false)
      return
    }

    try {
      const res = await migracoesService.executarMigracaoLote({
        tenantId,
        nomeArquivo: nomeArquivo || 'planilha_migracao.csv',
        modoDuplicidade,
        empresas: empresasValidasParaEnvio,
        certificadosArquivos: certificadosAnexados.filter((c) => c.cnpjAssociado),
      })

      setResultadoMigracao(res)
      setEtapa('relatorio')
      onImportacaoSucesso()

      toast({
        title: 'Migração concluída!',
        description: `${res.resumo.importadas} nova(s) empresa(s) importada(s), ${res.resumo.atualizadas} atualizada(s).`,
      })
    } catch (err: unknown) {
      console.error('Erro na execução da migração:', err)
      const msg = err instanceof Error ? err.message : 'Falha na comunicação com o backend.'
      toast({
        variant: 'destructive',
        title: 'Falha na migração',
        description: msg,
      })
    } finally {
      setExecutando(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetar()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden border-[#E2E8F0]">
        {/* Header do Wizard com progresso visual */}
        <DialogHeader className="p-5 pb-4 border-b border-slate-100 bg-[#F8FAFC]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#0B1F3A] to-[#0FA3A3] text-white flex items-center justify-center shadow-xs">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-[#1A2333]">
                  Importação de Empresas (Migração de Sistema)
                </DialogTitle>
                <DialogDescription className="text-xs text-[#64748B]">
                  Migre carteiras de clientes de softwares contábeis anteriores via planilha com
                  validação e anti-duplicidade
                </DialogDescription>
              </div>
            </div>

            {/* Stepper de progresso */}
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B]">
              <span
                className={`px-2 py-0.5 rounded-full transition-colors ${
                  etapa === 'modelo_upload'
                    ? 'bg-[#0FA3A3] text-white'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                1. Arquivo
              </span>
              <span>→</span>
              <span
                className={`px-2 py-0.5 rounded-full transition-colors ${
                  etapa === 'mapeamento'
                    ? 'bg-[#0FA3A3] text-white'
                    : etapa === 'validacao' || etapa === 'certificados' || etapa === 'relatorio'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                2. Mapeamento
              </span>
              <span>→</span>
              <span
                className={`px-2 py-0.5 rounded-full transition-colors ${
                  etapa === 'validacao'
                    ? 'bg-[#0FA3A3] text-white'
                    : etapa === 'certificados' || etapa === 'relatorio'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                3. Validação
              </span>
              <span>→</span>
              <span
                className={`px-2 py-0.5 rounded-full transition-colors ${
                  etapa === 'certificados'
                    ? 'bg-[#0FA3A3] text-white'
                    : etapa === 'relatorio'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                4. Certificados (Opcional)
              </span>
              <span>→</span>
              <span
                className={`px-2 py-0.5 rounded-full transition-colors ${
                  etapa === 'relatorio' ? 'bg-[#0FA3A3] text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                5. Relatório
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo do Wizard */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ETAPA 1 e 2: MODELO E UPLOAD */}
          {etapa === 'modelo_upload' && (
            <div className="space-y-4">
              {/* Card de download do modelo oficial */}
              <div className="p-4 rounded-2xl border border-teal-200 bg-linear-to-r from-teal-50/60 to-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#0FA3A3]/10 text-[#0FA3A3] flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1A2333]">
                      Baixe o Modelo Oficial de Migração (CSV / Planilha)
                    </h4>
                    <p className="text-[11px] text-[#64748B]">
                      Contém todas as 22 colunas aceitas: Razão Social, CNPJ, Regime, Endereço,
                      CNAE, Sócios, Honorários e mais.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadModelo}
                  className="gap-2 text-xs h-9 rounded-xl border-[#0FA3A3] text-[#0FA3A3] hover:bg-[#F0FDFA] shrink-0 font-semibold"
                >
                  <Download className="h-4 w-4" />
                  <span>Baixar Planilha Modelo (.CSV)</span>
                </Button>
              </div>

              {/* Área de Drag-and-Drop */}
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleProcessarArquivo(e.dataTransfer.files[0])
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#CBD5E1] hover:border-[#0FA3A3] transition-colors rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-[#F8FAFC] hover:bg-[#F0FDFA]"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.tsv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleProcessarArquivo(e.target.files[0])
                    }
                  }}
                />
                <div className="h-14 w-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-[#0FA3A3]">
                  {lendoArquivo ? (
                    <Loader2 className="h-7 w-7 animate-spin" />
                  ) : (
                    <UploadCloud className="h-7 w-7" />
                  )}
                </div>

                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-[#1A2333]">
                    {lendoArquivo
                      ? 'Lendo arquivo e identificando colunas...'
                      : 'Arraste a planilha de migração ou clique para selecionar'}
                  </p>
                  <p className="text-xs text-[#64748B]">
                    Formatos aceitos: CSV (recomendado), TSV ou XLSX exportado do seu sistema
                    contábil
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-white border-slate-200 text-[#475569]"
                  >
                    Domínio Sistemas
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-white border-slate-200 text-[#475569]"
                  >
                    Alterdata
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-white border-slate-200 text-[#475569]"
                  >
                    Questor
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-white border-slate-200 text-[#475569]"
                  >
                    Fortes
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-white border-slate-200 text-[#475569]"
                  >
                    Prosoft / Sage
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-white border-slate-200 text-[#475569]"
                  >
                    Planilhas Personalizadas
                  </Badge>
                </div>
              </div>

              {/* Informações sobre anti-duplicidade e segurança */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Card className="rounded-xl border-[#E2E8F0] shadow-2xs p-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-[#0FA3A3] shrink-0 mt-0.5" />
                    <div className="space-y-0.5 text-xs">
                      <p className="font-bold text-[#1A2333]">Anti-Duplicidade por CNPJ</p>
                      <p className="text-[#64748B] text-[11px]">
                        Empresas já cadastradas podem ser atualizadas ou puladas para evitar
                        duplicações no escritório.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-xl border-[#E2E8F0] shadow-2xs p-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 text-xs">
                      <p className="font-bold text-[#1A2333]">Auditoria e Rastreabilidade</p>
                      <p className="text-[#64748B] text-[11px]">
                        Cada migração gera registro com usuário responsável, data, arquivo e motivo
                        de cada linha.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ETAPA 3: MAPEAMENTO DE COLUNAS */}
          {etapa === 'mapeamento' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-[#1A2333]">
                    Mapeamento de Colunas ({linhasBrutas.length} empresas detectadas)
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Confirme a correspondência entre os cabeçalhos da sua planilha e os campos do
                    Rumo Contábil.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-teal-200 bg-teal-50 text-[#0FA3A3] text-xs"
                  >
                    Arquivo: {nomeArquivo}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                {cabecalhosArquivo.map((colName) => {
                  const valorMapeado = mapeamento[colName] || ''
                  const colunaDef = COLUNAS_SUPORTADAS.find((c) => c.chave === valorMapeado)

                  return (
                    <div
                      key={colName}
                      className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 sm:max-w-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#1A2333] font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                            {colName}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#64748B]">Coluna encontrada no arquivo</p>
                      </div>

                      <div className="flex items-center gap-2 sm:w-80">
                        <Select
                          value={valorMapeado || 'ignorar'}
                          onValueChange={(val) => {
                            setMapeamento((prev) => ({
                              ...prev,
                              [colName]:
                                val === 'ignorar' ? '' : (val as keyof EmpresaMigracaoLinhaItem),
                            }))
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-xl border-[#E2E8F0]">
                            <SelectValue placeholder="Ignorar esta coluna" />
                          </SelectTrigger>
                          <SelectContent className="max-h-56">
                            <SelectItem value="ignorar" className="text-xs text-slate-400">
                              (Ignorar / Não importar)
                            </SelectItem>
                            {COLUNAS_SUPORTADAS.map((col) => (
                              <SelectItem key={col.chave} value={col.chave} className="text-xs">
                                {col.rotulo} {col.obrigatorio ? '*' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {colunaDef?.obrigatorio && (
                          <Badge className="bg-amber-100 text-amber-800 text-[10px] shrink-0">
                            Obrigatório
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Opção de Anti-Duplicidade */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-[#1A2333]">
                      Regra de Anti-Duplicidade por CNPJ
                    </Label>
                    <p className="text-[11px] text-[#64748B]">
                      Se uma empresa na planilha já existir no escritório:
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-[#1A2333] cursor-pointer">
                      <input
                        type="radio"
                        name="antiDuplicidade"
                        checked={modoDuplicidade === 'atualizar'}
                        onChange={() => setModoDuplicidade('atualizar')}
                        className="text-[#0FA3A3] focus:ring-[#0FA3A3]"
                      />
                      <span>Atualizar dados existentes</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-xs text-[#1A2333] cursor-pointer">
                      <input
                        type="radio"
                        name="antiDuplicidade"
                        checked={modoDuplicidade === 'pular'}
                        onChange={() => setModoDuplicidade('pular')}
                        className="text-[#0FA3A3] focus:ring-[#0FA3A3]"
                      />
                      <span>Pular empresa existente</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 4: VALIDAÇÃO PRÉVIA LINHA A LINHA */}
          {etapa === 'validacao' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-[10px] font-semibold text-emerald-700 uppercase">
                      Prontas para Importar
                    </p>
                    <p className="text-sm font-bold text-emerald-950">{totalValidas}</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                  <div>
                    <p className="text-[10px] font-semibold text-amber-700 uppercase">
                      Com Avisos (Importáveis)
                    </p>
                    <p className="text-sm font-bold text-amber-950">{totalComAvisos}</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl border border-red-200 bg-red-50/50 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-[#EF4444]" />
                  <div>
                    <p className="text-[10px] font-semibold text-red-700 uppercase">
                      Com Erros (Serão Puladas)
                    </p>
                    <p className="text-sm font-bold text-red-950">{totalComErros}</p>
                  </div>
                </div>
              </div>

              {/* Tabela de prévia linha a linha */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="max-h-[340px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-[#64748B]">
                        <th className="py-2.5 px-3">Linha</th>
                        <th className="py-2.5 px-3">Empresa</th>
                        <th className="py-2.5 px-3">CNPJ</th>
                        <th className="py-2.5 px-3">Regime / Porte</th>
                        <th className="py-2.5 px-3">Localização</th>
                        <th className="py-2.5 px-3">Status de Validação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {linhasValidadas.map((item) => (
                        <tr
                          key={item.linhaNumero}
                          className={
                            item.status === 'erro'
                              ? 'bg-red-50/40 hover:bg-red-50/70'
                              : item.status === 'aviso'
                                ? 'bg-amber-50/30 hover:bg-amber-50/60'
                                : 'hover:bg-slate-50/70'
                          }
                        >
                          <td className="py-2.5 px-3 font-mono text-slate-500 font-bold">
                            #{item.linhaNumero}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#1A2333] max-w-xs truncate">
                            {item.dados.razao_social || (
                              <span className="text-red-500 italic">Razão Social Ausente</span>
                            )}
                            {item.dados.nome_fantasia && (
                              <p className="text-[10px] text-slate-500 truncate">
                                {item.dados.nome_fantasia}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {item.dados.cnpj ? (
                              maskCnpj(item.dados.cnpj)
                            ) : (
                              <span className="text-red-500 italic">Ausente</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {item.dados.regime_tributario || 'Simples Nacional'}
                            {item.dados.porte ? ` (${item.dados.porte.toUpperCase()})` : ''}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {item.dados.cidade
                              ? `${item.dados.cidade}/${item.dados.uf || 'SP'}`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            {item.status === 'valido' && (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[10px] gap-1">
                                <Check className="h-3 w-3" />
                                Válida
                              </Badge>
                            )}
                            {item.status === 'aviso' && (
                              <div className="space-y-0.5">
                                <Badge className="bg-amber-100 text-amber-800 text-[10px] gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Aviso
                                </Badge>
                                <p className="text-[10px] text-amber-800">{item.avisos[0]}</p>
                              </div>
                            )}
                            {item.status === 'erro' && (
                              <div className="space-y-0.5">
                                <Badge className="bg-red-100 text-red-800 text-[10px] gap-1">
                                  <X className="h-3 w-3" />
                                  Inválida
                                </Badge>
                                <p className="text-[10px] text-red-700 font-medium">
                                  {item.erros[0]}
                                </p>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 5: ANEXO DE CERTIFICADOS DIGITAIS A1 (.PFX/.P12) */}
          {etapa === 'certificados' && (
            <div className="space-y-4">
              {/* Destaque informativo: Etapa 100% Opcional */}
              <div className="p-4 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50/80 via-emerald-50/40 to-white flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#0FA3A3]/10 text-[#0FA3A3] flex items-center justify-center shrink-0 mt-0.5">
                  <Info className="h-5 w-5" />
                </div>
                <div className="space-y-1 text-xs flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-[#1A2333]">Anexo de Certificados Digitais A1</h4>
                    <Badge
                      variant="outline"
                      className="border-teal-300 bg-white text-[#0FA3A3] text-[10px] font-bold uppercase tracking-wider"
                    >
                      Etapa Opcional
                    </Badge>
                  </div>
                  <p className="text-[#475569] leading-relaxed">
                    Você <strong>não precisa anexar certificados agora</strong> para concluir a
                    migração das empresas. Se preferir, avance diretamente: os certificados e suas
                    respectivas senhas podem ser vinculados a qualquer momento depois, na ficha
                    individual de cada empresa (aba <em>Certificado Digital</em>).
                  </p>
                </div>
              </div>

              {/* Card de Aviso de Segurança de Senha */}
              <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/60 flex items-start gap-3">
                <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs">
                  <h5 className="font-semibold text-amber-950">Segurança e Sigilo de Senhas</h5>
                  <p className="text-amber-900/90 text-[11px] leading-relaxed">
                    Por conformidade com a LGPD e segurança da informação,{' '}
                    <strong>
                      senhas de certificados nunca devem ser enviadas em planilhas ou importações em
                      lote
                    </strong>
                    . As senhas devem ser cadastradas individualmente na ficha da empresa após a
                    importação.
                  </p>
                </div>
              </div>

              {/* Upload múltiplo de arquivos .pfx */}
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleUploadCertificadosMultiplos(e.dataTransfer.files)
                  }
                }}
                onClick={() => certFileInputRef.current?.click()}
                className="border-2 border-dashed border-teal-300 hover:border-[#0FA3A3] transition-colors rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-[#F0FDFA]/60 hover:bg-[#F0FDFA]"
              >
                <input
                  ref={certFileInputRef}
                  type="file"
                  multiple
                  accept=".pfx,.p12"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleUploadCertificadosMultiplos(e.target.files)
                    }
                  }}
                />
                <div className="h-12 w-12 rounded-2xl bg-white shadow-xs border border-teal-200 flex items-center justify-center text-[#0FA3A3]">
                  <FileKey2 className="h-6 w-6" />
                </div>
                <div className="text-center space-y-0.5">
                  <p className="text-xs font-bold text-[#1A2333]">
                    Arraste múltiplos arquivos de certificado (.pfx / .p12) ou clique para
                    selecionar
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    Dica: se o nome do arquivo contiver o CNPJ da empresa, a associação é feita
                    automaticamente.
                  </p>
                </div>
              </div>

              {/* Tabela de Associação Certificado <-> Empresa */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#1A2333]">
                      Associação de Certificados ({certificadosAnexados.length} anexado(s))
                    </span>
                    <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600">
                      Opcional
                    </Badge>
                  </div>
                  <span className="text-[11px] text-[#64748B]">
                    {
                      certificadosAnexados.filter((c) =>
                        empresasAptas.some(
                          (e) => (e.dados.cnpj || '').replace(/\D/g, '') === c.cnpjAssociado,
                        ),
                      ).length
                    }{' '}
                    associado(s) com sucesso
                  </span>
                </div>

                <div className="max-h-[300px] overflow-y-auto">
                  {certificadosAnexados.length === 0 ? (
                    <div className="py-8 px-4 text-center text-xs text-[#64748B] space-y-2">
                      <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-slate-100 text-slate-400 mb-1">
                        <KeyRound className="h-5 w-5" />
                      </div>
                      <p className="font-medium text-slate-700">
                        Nenhum certificado digital anexado nesta etapa.
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                        Tudo bem! Você pode clicar em{' '}
                        <strong>&quot;Importar sem Certificados&quot;</strong> abaixo para concluir
                        a migração agora mesmo. Os certificados poderão ser adicionados
                        individualmente na ficha de cada empresa quando desejar.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase text-[#64748B]">
                          <th className="py-2.5 px-3">Arquivo .PFX</th>
                          <th className="py-2.5 px-3">Tamanho</th>
                          <th className="py-2.5 px-3">Vincular à Empresa (CNPJ)</th>
                          <th className="py-2.5 px-3">Validade / Emissor</th>
                          <th className="py-2.5 px-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {certificadosAnexados.map((item, idx) => {
                          const sizeKb = Math.round(item.tamanho / 1024)
                          return (
                            <tr key={idx} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3 font-medium text-[#1A2333] flex items-center gap-1.5 max-w-xs truncate">
                                <KeyRound className="h-3.5 w-3.5 text-[#0FA3A3] shrink-0" />
                                <span className="truncate">{item.nomeArquivo}</span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                                {sizeKb} KB
                              </td>
                              <td className="py-2.5 px-3">
                                <Select
                                  value={item.cnpjAssociado || 'desvinculado'}
                                  onValueChange={(val) => {
                                    setCertificadosAnexados((prev) =>
                                      prev.map((c, i) =>
                                        i === idx
                                          ? {
                                              ...c,
                                              cnpjAssociado: val === 'desvinculado' ? '' : val,
                                            }
                                          : c,
                                      ),
                                    )
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs rounded-xl border-[#E2E8F0] min-w-[200px]">
                                    <SelectValue placeholder="Selecione a empresa..." />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-52">
                                    <SelectItem
                                      value="desvinculado"
                                      className="text-xs text-slate-400"
                                    >
                                      (Não associar a nenhuma)
                                    </SelectItem>
                                    {empresasAptas.map((emp) => {
                                      const clean = (emp.dados.cnpj || '').replace(/\D/g, '')
                                      return (
                                        <SelectItem key={clean} value={clean} className="text-xs">
                                          {emp.dados.razao_social || 'Empresa'} ({maskCnpj(clean)})
                                        </SelectItem>
                                      )
                                    })}
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-slate-600">
                                {item.validade ? (
                                  <span>Vence: {item.validade}</span>
                                ) : (
                                  <span className="text-slate-400">Padrão 1 ano</span>
                                )}
                                {item.emissor && <span> • {item.emissor}</span>}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setCertificadosAnexados((prev) =>
                                      prev.filter((_, i) => i !== idx),
                                    )
                                  }}
                                  className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 6: RELATÓRIO FINAL */}
          {etapa === 'relatorio' && resultadoMigracao && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-linear-to-r from-emerald-50/80 to-white border border-emerald-200 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950">
                      Importação de Migração Concluída com Sucesso!
                    </h3>
                    <p className="text-xs text-emerald-800">
                      Os dados foram processados no servidor com registro de auditoria e inseridos
                      na sua carteira de empresas.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-3 bg-white rounded-xl border border-emerald-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">
                      Novas Importadas
                    </span>
                    <p className="text-xl font-bold text-emerald-700">
                      {resultadoMigracao.resumo.importadas}
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-blue-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">
                      Atualizadas
                    </span>
                    <p className="text-xl font-bold text-blue-700">
                      {resultadoMigracao.resumo.atualizadas}
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-amber-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">
                      Puladas (Anti-Duplicidade)
                    </span>
                    <p className="text-xl font-bold text-amber-700">
                      {resultadoMigracao.resumo.puladas}
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-red-200">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">
                      Erros / Rejeitadas
                    </span>
                    <p className="text-xl font-bold text-red-700">
                      {resultadoMigracao.resumo.erros}
                    </p>
                  </div>
                </div>

                {/* Sub-resumo de Certificados Digitais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="p-2.5 bg-white/90 rounded-xl border border-teal-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-[#0FA3A3]" />
                      <span className="text-xs font-semibold text-slate-700">
                        Empresas com Certificado Digital A1 Integrado
                      </span>
                    </div>
                    <Badge className="bg-teal-100 text-teal-800 text-xs">
                      {resultadoMigracao.resumo.comCertificado ?? 0}
                    </Badge>
                  </div>

                  <div className="p-2.5 bg-white/90 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-700">
                        Empresas sem Certificado A1 Anexado
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs border-slate-300 text-slate-600 bg-slate-50"
                    >
                      {resultadoMigracao.resumo.semCertificado ?? 0}
                    </Badge>
                  </div>
                </div>

                {/* Nota informativa amigável para empresas sem certificado */}
                {(resultadoMigracao.resumo.semCertificado ?? 0) > 0 && (
                  <div className="p-3 bg-white/90 rounded-xl border border-teal-100 flex items-start gap-2 text-xs text-slate-600">
                    <Info className="h-4 w-4 text-[#0FA3A3] shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong>Nota informativa:</strong> {resultadoMigracao.resumo.semCertificado}{' '}
                      empresa(s) foram migradas sem certificado digital e estão plenamente
                      operacionais. Você poderá vincular o arquivo .pfx e configurar a senha a
                      qualquer momento na ficha de cada empresa (aba <em>Certificado Digital</em>).
                    </p>
                  </div>
                )}
              </div>

              {/* Detalhamento das linhas */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-[#64748B]">
                        <th className="py-2.5 px-3">Linha</th>
                        <th className="py-2.5 px-3">Empresa</th>
                        <th className="py-2.5 px-3">CNPJ</th>
                        <th className="py-2.5 px-3">Certificado Digital</th>
                        <th className="py-2.5 px-3">Resultado</th>
                        <th className="py-2.5 px-3">Detalhe / Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {resultadoMigracao.relatorio.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-500">
                            #{r.linha}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#1A2333] max-w-xs truncate">
                            {r.razao_social}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {r.cnpj ? maskCnpj(r.cnpj) : '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            {r.tem_certificado ? (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[10px] gap-1">
                                <ShieldCheck className="h-3 w-3" />
                                Anexado
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-slate-200 text-slate-500 text-[10px]"
                              >
                                Não anexado (vincular depois)
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {r.status === 'importada' && (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                                Importada
                              </Badge>
                            )}
                            {r.status === 'atualizada' && (
                              <Badge className="bg-blue-100 text-blue-800 text-[10px]">
                                Atualizada
                              </Badge>
                            )}
                            {r.status === 'pulada' && (
                              <Badge className="bg-amber-100 text-amber-800 text-[10px]">
                                Pulada
                              </Badge>
                            )}
                            {r.status === 'erro' && (
                              <Badge className="bg-red-100 text-red-800 text-[10px]">Erro</Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {r.motivo}
                            {r.certificado_info && (
                              <span className="block text-[10px] text-teal-700 font-medium">
                                • {r.certificado_info}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer com botões de navegação */}
        <DialogFooter className="p-4 border-t border-slate-100 bg-[#F8FAFC] flex flex-col sm:flex-row items-center justify-between gap-2">
          {etapa === 'modelo_upload' ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs h-9 rounded-xl border-[#E2E8F0]"
            >
              Cancelar
            </Button>
          ) : etapa === 'relatorio' ? (
            <Button
              type="button"
              variant="outline"
              onClick={resetar}
              className="text-xs h-9 rounded-xl border-[#E2E8F0]"
            >
              Importar Nova Planilha
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (etapa === 'certificados') setEtapa('validacao')
                else if (etapa === 'validacao') setEtapa('mapeamento')
                else if (etapa === 'mapeamento') setEtapa('modelo_upload')
              }}
              className="gap-1.5 text-xs h-9 rounded-xl border-[#E2E8F0]"
            >
              {' '}
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Voltar</span>
            </Button>
          )}

          <div className="flex items-center gap-2">
            {etapa === 'mapeamento' && (
              <Button
                type="button"
                onClick={() => setEtapa('validacao')}
                className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-9 px-5 shadow-xs"
              >
                <span>Avançar para Validação</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}

            {etapa === 'validacao' && (
              <Button
                type="button"
                onClick={() => setEtapa('certificados')}
                disabled={totalValidas + totalComAvisos === 0}
                className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-9 px-5 shadow-xs"
              >
                <span>Avançar para Certificados (Opcional)</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}

            {etapa === 'certificados' && (
              <Button
                type="button"
                onClick={handleExecutarMigracao}
                disabled={executando || totalValidas + totalComAvisos === 0}
                className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-9 px-6 shadow-xs"
              >
                {executando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processando Migração no Servidor...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {certificadosAnexados.length > 0
                        ? `Confirmar e Importar (${totalValidas + totalComAvisos} empresas + ${certificadosAnexados.length} certs)`
                        : `Importar sem Certificados (${totalValidas + totalComAvisos} empresas)`}
                    </span>
                  </>
                )}
              </Button>
            )}

            {etapa === 'relatorio' && (
              <Button
                type="button"
                onClick={() => {
                  onOpenChange(false)
                  resetar()
                }}
                className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-9 px-5 shadow-xs"
              >
                <span>Concluir e Ver Empresas</span>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

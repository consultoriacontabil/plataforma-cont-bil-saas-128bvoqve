import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Printer,
  UserCheck,
  Lock,
  Building2,
  Users,
  FileSpreadsheet,
  Calculator,
  MessageSquare,
  Clock,
  Sparkles,
  Award,
  AlertCircle,
  HelpCircle,
  Search,
  GitBranch,
  Network,
  PackagePlus,
  Boxes,
  SlidersHorizontal,
  FileUp,
  Download,
  BookOpen,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

interface ChecklistItemState {
  id: string
  label: string
  checked: boolean
}

export default function PopTreinamentoPage() {
  const { member, user, tenant } = useAuth()
  const { toast } = useToast()

  const perfil = member?.perfil || 'auxiliar'
  const isReadOnly = perfil === 'auxiliar' || perfil === 'consultor'
  const isCliente = perfil === 'cliente'

  // Estado da Ficha de Treinamento e Habilitação Operacional
  const [operadorNome, setOperadorNome] = useState('Operador Elliza Contábil (Synapse Robotics)')
  const [supervisorNome, setSupervisorNome] = useState(
    tenant?.responsavel_tecnico || user?.name || 'Responsável Técnico CFC',
  )
  const [dataTreinamento, setDataTreinamento] = useState(new Date().toISOString().slice(0, 10))
  const [checklistHabilitacao, setChecklistHabilitacao] = useState<ChecklistItemState[]>([
    {
      id: 'onb',
      label: '01. Onboarding: Busca CNPJ, migração de planilha e guarda de certificado A1',
      checked: true,
    },
    {
      id: 'dp_folha',
      label: '02. DP: Ciclo mensal de folha (verbas → cálculo CLT → e-Social S-1200/S-1299)',
      checked: true,
    },
    {
      id: 'dp_reinf',
      label: '02. DP & Tributário: EFD-Reinf (R-2010/R-2099) e consolidação da DCTFWeb',
      checked: true,
    },
    {
      id: 'dp_convencoes',
      label: '02. DP: Monitoramento de CCTs com aplicação de reajuste salarial em 1 clique',
      checked: true,
    },
    {
      id: 'fiscal_sped',
      label: '03. Fiscal: Apurações tributárias, validação PVA e geração SPED (ECD/ECF/EFD)',
      checked: true,
    },
    {
      id: 'fiscal_guias',
      label: '03. Fiscal: Baixas de guias DAS/DARF e extratos de parcelamento PAR/PER-DCOMP',
      checked: true,
    },
    {
      id: 'contabil_fecho',
      label: '04. Contábil: Conciliação bancária, lançamentos e Fecho Mensal com trava retroativa',
      checked: true,
    },
    {
      id: 'whatsapp_ia',
      label: '05. Atendimento WhatsApp: Agente IA em Modo Supervisionado com escala humana',
      checked: true,
    },
    {
      id: 'nfse_aprovacao',
      label:
        '05. NFS-e: Padrão assistivo obrigatório (robô prepara minuta, contador aprova e assina)',
      checked: true,
    },
    {
      id: 'obrigacoes_08h',
      label: '06. Prazos: Varredura diária das 08h (cron diário com proteção anti-flood de 20h)',
      checked: true,
    },
    {
      id: 'monitoramento_cnd',
      label: '07. Monitoramento CND & Radar: DTE, CNDs e Simulador da Reforma (EC 132 / LC 214)',
      checked: true,
    },
    {
      id: 'abertura_empresa',
      label:
        '08. Abertura de Empresa: Workflows simultâneos, link público 3 passos e Kanban de atos',
      checked: true,
    },
    {
      id: 'migracoes_onboarding',
      label: '09. Migrações & Onboarding: Checklists Entrada e Saída, termos CRC e handover',
      checked: true,
    },
    {
      id: 'tripe_integracao',
      label: '10. Integração do Tripé: Diagnóstico 4 elos (DP → Fiscal → Contábil → Obrigações)',
      checked: true,
    },
    {
      id: 'fiscal_defis_xml',
      label:
        '11. Fiscal Avançado: DEFIS 4 abas e Importação de XML NF-e/NFS-e em lote com isolamento',
      checked: true,
    },
    {
      id: 'lote_patrimonio_motor',
      label: '12. Operações em Lote multi-empresas, Patrimônio físico e Motor Normativo Unificado',
      checked: true,
    },
    {
      id: 'complementos_operacionais',
      label: 'Complementos: Importação S-2200, Baixa assistida e-CAC, Monitor CND e Manual /manual',
      checked: true,
    },
    {
      id: 'regras_ouro',
      label: 'Regras Inegociáveis: Zero alucinação, isolamento multi-tenant, cofre A1 e supervisão',
      checked: true,
    },
  ])

  const [activeTab, setActiveTab] = useState('visao_geral')
  const [searchTerm, setSearchTerm] = useState('')

  // Dicionário de busca para guiar o operador na aba correta
  const searchResultsCount = useMemo(() => {
    if (!searchTerm.trim()) return null
    const term = searchTerm.toLowerCase()
    const match = (text: string) => text.toLowerCase().includes(term)

    let hits = 0
    if (match('abertura link publico kanban viabilidade dbe contrato social junta')) hits++
    if (match('migracao entrada saida handover crc procuracao saldo inicial data de corte')) hits++
    if (match('tripe integracao lote-folha lote-fisc lote-liq partidas dobradas elo quebrado'))
      hits++
    if (match('defis simples nacional rascunho xml lote nf-e nfs-e anti-duplicidade qsa')) hits++
    if (match('lote multi-empresas patrimonio depreciacao motor normativo inss irrf simples anexo'))
      hits++
    if (match('s-2200 colaboradores esocial e-cac baixa assistida cnd manual')) hits++
    if (match('onboarding a1 folha sped fecho whatsapp nfse prazos reforma')) hits++
    return hits
  }, [searchTerm])

  const toggleChecklist = (id: string) => {
    if (isReadOnly) {
      toast({
        title: 'Apenas leitura',
        description:
          'Perfil Auxiliar possui acesso para consulta. Edição restrita a Contadores e Administradores.',
      })
      return
    }
    setChecklistHabilitacao((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    )
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSalvarFicha = () => {
    toast({
      title: 'Ficha de Treinamento Validada',
      description: `Certificação registrada para ${operadorNome} com supervisão técnica de ${supervisorNome}.`,
    })
  }

  if (isCliente) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <ShieldCheck className="h-16 w-16 text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-800">Acesso Restrito à Equipe Técnica</h1>
        <p className="text-slate-600 mt-2">
          O Procedimento Operacional Padrão (POP) e os manuais de automação da Elliza Contábil são
          de uso interno do escritório contábil.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto print:p-0 print:max-w-none">
      {/* Cabeçalho do Documento */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6 print:border-b-2 print:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge className="bg-[#0FA3A3] text-white">POP-ELLIZA-2026.1</Badge>
            <Badge variant="outline" className="text-slate-600">
              Versão 0.0.83 • NBC PP 01 & NBC PG 01
            </Badge>
            <Badge className="bg-emerald-600 text-white">Modo Supervisionado</Badge>
            <Badge
              variant="secondary"
              className="bg-teal-50 text-[#0FA3A3] font-semibold border-teal-200"
            >
              12 Procedimentos Operacionais + Complementos
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Procedimento Operacional Padrão (POP) & Guia de Treinamento
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manual de Operação Assistiva da automação contábil{' '}
            <a
              href="https://ellizacontabil.com.br/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#0FA3A3] underline hover:text-[#0c8282]"
            >
              Elliza Contábil (Synapse Robotics)
            </a>{' '}
            na Plataforma Rumo. Guia de referência rápida e ativação complementar em{' '}
            <Link
              to="/manual"
              className="font-semibold text-[#0FA3A3] underline hover:text-[#0c8282]"
            >
              /manual
            </Link>
            .
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden flex-wrap">
          <Link to="/elliza">
            <Button className="bg-[#0FA3A3] hover:bg-[#0c8282] text-white flex items-center gap-2 text-xs h-9 shadow-xs">
              <Bot className="h-4 w-4" />
              Conversar com ELLIZA 24/7
            </Button>
          </Link>
          <Link to="/manual">
            <Button
              variant="outline"
              className="border-teal-300 text-teal-800 hover:bg-teal-50 flex items-center gap-2 text-xs h-9"
            >
              <BookOpen className="h-4 w-4 text-[#0FA3A3]" />
              Manual de Ativação (/manual)
            </Button>
          </Link>
          <Button
            onClick={handlePrint}
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-2 text-xs h-9"
          >
            <Printer className="h-4 w-4" />
            Imprimir / Salvar PDF
          </Button>
          {!isReadOnly && (
            <Button
              onClick={handleSalvarFicha}
              className="bg-slate-800 hover:bg-slate-900 text-white flex items-center gap-2 text-xs h-9"
            >
              <Award className="h-4 w-4" />
              Validar Treinamento
            </Button>
          )}
        </div>
      </div>

      {/* Banner de Conformidade e Supervisão Humana */}
      <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 via-cyan-50 to-white p-4 text-sm text-slate-700 shadow-xs">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-6 w-6 text-[#0FA3A3] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">
              Padrão Operacional Assistivo: O Robô Prepara, o Contador Valida e Aprova
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              A Elliza Contábil opera como motor automatizado de pré-processamento, apurações
              preliminares e minutas. Nenhum ato com efeitos legais externos (transmissão de SPED,
              protocolo de e-Social/Reinf/DCTFWeb, transmissão de DEFIS, lote multi-empresas,
              emissão de NFS-e ou alteração de folha) é concluído sem chancela técnica de usuário
              habilitado (Contador/Administrador), garantindo conformidade estrita com o Conselho
              Federal de Contabilidade (CFC). Havendo dependência de credenciais externas do e-CAC
              ou portal público, opera em <strong>Modo Supervisão</strong> sem simular falso
              sucesso.
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Busca de Procedimentos */}
      <div className="relative print:hidden">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Filtrar tópicos do POP (ex.: abertura, migrações, tripé, DEFIS, XML lote, lote multi-empresas, patrimônio, motor normativo, S-2200, e-CAC, CND)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-10 bg-white border-slate-200 text-sm"
        />
        {searchResultsCount !== null && (
          <div className="text-[11px] text-slate-500 mt-1 pl-1">
            Dica de navegação rápida: selecione a aba correspondente no menu abaixo para inspecionar
            os procedimentos detalhados.
          </div>
        )}
      </div>

      {/* Navegação por Abas do POP */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 p-1 flex flex-wrap h-auto gap-1 border border-slate-200 print:hidden">
          <TabsTrigger value="visao_geral" className="text-xs font-medium">
            Visão Geral & Regras
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="text-xs font-medium">
            1. Onboarding & A1
          </TabsTrigger>
          <TabsTrigger value="dp" className="text-xs font-medium">
            2. DP & e-Social
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="text-xs font-medium">
            3. Fiscal & SPED
          </TabsTrigger>
          <TabsTrigger value="contabil" className="text-xs font-medium">
            4. Contábil & Fecho
          </TabsTrigger>
          <TabsTrigger value="whatsapp_nfse" className="text-xs font-medium">
            5. WhatsApp & NFS-e
          </TabsTrigger>
          <TabsTrigger value="obrigacoes_prazos" className="text-xs font-medium">
            6. Prazos & Job 08h
          </TabsTrigger>
          <TabsTrigger value="monitoramento_cnd" className="text-xs font-medium">
            7. Monitoramento CND
          </TabsTrigger>
          <TabsTrigger
            value="abertura"
            className="text-xs font-medium bg-teal-50/70 text-teal-900 border border-teal-200"
          >
            8. Abertura de Empresa
          </TabsTrigger>
          <TabsTrigger
            value="migracoes"
            className="text-xs font-medium bg-teal-50/70 text-teal-900 border border-teal-200"
          >
            9. Migrações Entrada/Saída
          </TabsTrigger>
          <TabsTrigger
            value="tripe"
            className="text-xs font-medium bg-teal-50/70 text-teal-900 border border-teal-200"
          >
            10. Painel do Tripé
          </TabsTrigger>
          <TabsTrigger
            value="defis_xml"
            className="text-xs font-medium bg-teal-50/70 text-teal-900 border border-teal-200"
          >
            11. DEFIS & XML Lote
          </TabsTrigger>
          <TabsTrigger
            value="lote_patrimonio"
            className="text-xs font-medium bg-teal-50/70 text-teal-900 border border-teal-200"
          >
            12. Lote, Patrimônio & Motor
          </TabsTrigger>
          <TabsTrigger value="complementos" className="text-xs font-medium text-slate-700">
            Complementos & Manual
          </TabsTrigger>
          <TabsTrigger
            value="ficha_habilitacao"
            className="text-xs font-medium bg-teal-100/80 text-teal-950 font-semibold"
          >
            Ficha de Habilitação
          </TabsTrigger>
        </TabsList>

        {/* =========================================================================
            ABA 0: VISÃO GERAL & REGRAS INEFINÁVEIS
           ========================================================================= */}
        <TabsContent value="visao_geral" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900">
                  <Bot className="h-4 w-4 text-[#0FA3A3]" />
                  Perfil do Agente Elliza
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-2">
                <p>
                  Solução robótica desenvolvida para automatizar a rotina de coleta, extração
                  documental, pré-classificação e cálculos tributários/trabalhistas.
                </p>
                <div className="pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-800">Modo de Operação:</span>
                  <Badge variant="secondary" className="ml-2 bg-teal-50 text-[#0FA3A3] font-bold">
                    Supervisionado
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900">
                  <Lock className="h-4 w-4 text-emerald-600" />
                  Isolamento Multi-Tenant
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-2">
                <p>
                  Cada escritório contábil opera sob particionamento rígido via chave primária{' '}
                  <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">tenant_id</code>.
                </p>
                <p>
                  Nenhuma automação ou prompt de IA cruza fronteiras de escritórios, clientes ou
                  bancos de dados.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900">
                  <UserCheck className="h-4 w-4 text-indigo-600" />
                  Chancela Técnica CFC
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-2">
                <p>
                  Conforme a <b>NBC PP 01</b> e <b>NBC PG 01</b>, todo relatório, minuta de SPED ou
                  DARF emitido carrega o nome e CRC do Responsável Técnico:
                </p>
                <p className="font-medium text-slate-800">
                  {tenant?.responsavel_tecnico || 'Contador Responsável'} •{' '}
                  {tenant?.crc_responsavel || 'CRC Ativo'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* SEÇÃO: REGRAS INEFINÁVEIS */}
          <Card className="border-rose-200 bg-rose-50/40 shadow-xs">
            <CardHeader className="pb-3 border-b border-rose-100">
              <div className="flex items-center gap-2 text-rose-800">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
                <CardTitle className="text-base font-bold">
                  Regras Inegociáveis da Operação Elliza (Cláusulas Pétreas)
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-rose-700">
                A infração de qualquer uma das regras abaixo invalida a certificação do operador e
                aciona trava de segurança.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs text-slate-800">
              <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-rose-200 shadow-2xs">
                <span className="font-bold text-rose-700 text-sm">1.</span>
                <div>
                  <p className="font-semibold text-slate-900">
                    Nunca Transmitir para o Fisco sem Aprovação Humana (Assistivo Obrigatório)
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    A Elliza gera o XML de fechamento do e-Social, a escrituração do SPED, a DEFIS,
                    os lotes contábeis e a minuta da NFS-e. Contudo, o botão de transmissão externa
                    exige clique explícito de um usuário com perfil Contador ou Administrador.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-rose-200 shadow-2xs">
                <span className="font-bold text-rose-700 text-sm">2.</span>
                <div>
                  <p className="font-semibold text-slate-900">
                    Zero Alucinação: Nunca Inventar Valores, Prazos ou Fatos
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    Caso dados cadastrais, alíquotas ou dados bancários estejam ausentes ou
                    ilegíveis, a Elliza deve registrar status{' '}
                    <Badge variant="outline" className="text-amber-700">
                      pendente_credenciais
                    </Badge>{' '}
                    ou{' '}
                    <Badge variant="outline" className="text-blue-700">
                      modo_supervisao
                    </Badge>
                    . Jamais assumir valores fictícios.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-rose-200 shadow-2xs">
                <span className="font-bold text-rose-700 text-sm">3.</span>
                <div>
                  <p className="font-semibold text-slate-900">
                    Certificados A1 e Senhas Jamais em Planilhas ou Chats Abertos
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    Arquivos .pfx e senhas criptografadas trafegam exclusivamente pelo cofre de
                    certificados da plataforma em{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded">/empresas/:id</code>. É
                    expressamente vedado colar chaves privadas no WhatsApp ou em notas públicas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-rose-200 shadow-2xs">
                <span className="font-bold text-rose-700 text-sm">4.</span>
                <div>
                  <p className="font-semibold text-slate-900">
                    Isolamento Absoluto por Tenant (LGPD Contábil)
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    Dados salariais de colaboradores, faturamento e certidões pertencem
                    privativamente ao cliente. O agente inteligente utiliza apenas o contexto do
                    tenant autenticado.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 1: ONBOARDING DE CLIENTE
           ========================================================================= */}
        <TabsContent value="onboarding" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 01: Onboarding de Empresas & Gestão de A1
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Cadastro de novos clientes, migração em lote de carteiras, captura CNPJ e guarda
                    segura de credenciais.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">Tela: /empresas e /empresas/nova</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Habilitar a empresa na plataforma com dados societários validados, regime
                  tributário correto e cofre de certificados A1 pronto para integração
                  Gov.br/e-CAC/e-Social.
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Auxiliar Contábil pode pré-preencher e anexar documentos; Contador ou
                  Administrador aprova o cadastro final.
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Passo a Passo Operacional:
                </h3>
                <ol className="list-decimal pl-4 space-y-2">
                  <li>
                    <b>Entrada Cadastral:</b> Acesse a tela{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded">/empresas</code> e clique em{' '}
                    <i>Nova Empresa</i> ou utilize o <i>Cadastro Assistido por Documentos</i> (envio
                    do Cartão CNPJ ou Contrato Social em PDF).
                  </li>
                  <li>
                    <b>Consulta Pública CNPJ & CEP:</b> O robô Elliza consulta automaticamente as
                    bases públicas oficiais (ReceitaWS / BrasilAPI / ViaCEP), preenchendo Razão
                    Social, CNAEs, Regime Tributário e Endereço.
                  </li>
                  <li>
                    <b>Importação em Lote (Carteiras Migradas):</b> Para transferências de
                    escritórios, acione o botão <i>Importar Planilha</i>. Faça o upload do arquivo
                    CSV/XLSX modelo. O robô valida colunas e previne duplicidades de CNPJ.
                  </li>
                  <li>
                    <b>Certificado Digital A1:</b> Na aba <i>Certificado Digital</i> da empresa,
                    faça o upload do arquivo .pfx e registre a senha no cofre. O sistema audita
                    imediatamente a data de validade, emissor ICP-Brasil e titularidade.
                  </li>
                  <li>
                    <b>Credenciais Conector RFB / e-Social:</b> Caso a empresa possua procuração
                    eletrônica no e-CAC para o CNPJ do escritório contábil, marque a opção{' '}
                    <i>Transmissor por Procuração (Escritório)</i>.
                  </li>
                </ol>
              </div>

              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                <div className="flex items-center gap-2 font-semibold text-teal-900 mb-1">
                  <UserCheck className="h-4 w-4 text-[#0FA3A3]" />
                  Ponto de Aprovação Humana Obrigatório:
                </div>
                <p className="text-slate-600">
                  O regime tributário cadastrado (Simples Nacional, Lucro Presumido ou Lucro Real)
                  define todas as alíquotas e obrigações da empresa. O Contador Responsável deve
                  chancelar a consistência do enquadramento antes de disparar o Fecho Contábil.
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <div className="flex items-center gap-2 font-semibold text-amber-900 mb-1">
                  <HelpCircle className="h-4 w-4 text-amber-600" />
                  Tratamento de Exceções & Erros Comuns:
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li>
                    <b>Certificado com senha incorreta:</b> Registrar o log como{' '}
                    <i>modo_supervisao</i>. Notificar cliente via WhatsApp.
                  </li>
                  <li>
                    <b>CNPJ Inapto ou Suspenso na RFB:</b> O sistema bloqueia a emissão de notas e
                    gera tarefa prioritária no Workflow.
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 2: ROTINA DP & E-SOCIAL
           ========================================================================= */}
        <TabsContent value="dp" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Users className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 02: Rotina de Departamento Pessoal, CLT & e-Social
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Folha mensal, tabela progressiva INSS/IRRF, benefícios VT/VA/VR, CCT em 1
                    clique, férias, 13º, TRCT e EFD-Reinf/DCTFWeb.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">Tela: /departamento-pessoal</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Calcular a folha de pagamento CLT em conformidade com as tabelas legais vigentes,
                  emitir recibos de benefícios, atualizar pisos salariais por CCT e protocolar a
                  cadeia de fechamento (S-1200 → S-1299 → R-2099 → DCTFWeb).
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Auxiliar lança variáveis e aponta dias úteis; Contador ou Administrador homologa
                  rescisões e transmite DCTFWeb.
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Fluxo da Folha Mensal:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-slate-100 border border-slate-200">
                    <span className="font-bold text-[#0FA3A3] block">Passo 1</span>
                    <span className="font-semibold">Lançamento de Verbas</span>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Horas extras, faltas, DSR e comissões do mês
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-100 border border-slate-200">
                    <span className="font-bold text-[#0FA3A3] block">Passo 2</span>
                    <span className="font-semibold">Cálculo & Conferência</span>
                    <p className="text-[10px] text-slate-500 mt-1">
                      INSS progressivo, IRRF simplificado x legal e FGTS
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-100 border border-slate-200">
                    <span className="font-bold text-[#0FA3A3] block">Passo 3</span>
                    <span className="font-semibold">Fila e-Social S-1.1</span>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Geração dos eventos S-1200 e fechamento S-1299
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-100 border border-slate-200">
                    <span className="font-bold text-[#0FA3A3] block">Passo 4</span>
                    <span className="font-semibold">DCTFWeb & Financeiro</span>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Consolidação e envio de DARF Previdenciário a Pagar
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Procedimentos Especiais do Módulo DP:
                </h3>
                <ul className="space-y-2">
                  <li className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <b>• Convenções Coletivas (CCT) em 1 Clique:</b> Na aba{' '}
                    <i>Convenções Coletivas</i>, a Elliza monitora as datas-bases dos sindicatos
                    (alertas aos 60, 30 e 7 dias antes do vencimento). Quando a nova CCT é
                    cadastrada com o percentual de reajuste, o botão{' '}
                    <i>Aplicar Reajuste na Folha</i> calcula o novo salário e aponta retroativos com
                    geração automática de histórico salarial e log de auditoria com opção de
                    reversão (rollback).
                  </li>
                  <li className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <b>• Benefícios (VT / VA / VR) com Recibo Formal:</b> O painel calcula a
                    coparticipação legal de até 6% sobre o salário-base para o Vale Transporte (Art.
                    4º Lei 7.418/85) e gera o <i>Recibo Consolidado da Empresa</i> pronto para
                    assinatura do colaborador ou entrega física.
                  </li>
                  <li className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <b>• Rescisão Contratual com TRCT:</b> Simulação com verificação das médias dos
                    últimos 12 meses, aviso prévio proporcional pela Lei 12.506/11 e cálculo de
                    multa rescisória de 40% do FGTS. A homologação gera o evento <b>S-2299</b> e
                    altera o status do colaborador para <i>demitido</i>.
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                <div className="flex items-center gap-2 font-semibold text-teal-900 mb-1">
                  <UserCheck className="h-4 w-4 text-[#0FA3A3]" />
                  Ponto de Aprovação Humana Obrigatório:
                </div>
                <p className="text-slate-600">
                  O fechamento do e-Social (evento S-1299) e a transmissão da DCTFWeb consolidada
                  exigem revisão do Contador. O sistema exibe o painel de consistência cruzando
                  folha e apuração previdenciária antes do envio.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 3: ROTINA FISCAL & SPED
           ========================================================================= */}
        <TabsContent value="fiscal" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 03: Rotina Fiscal, SPED & Parcelamentos Federais
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Apurações fiscais (DAS, PIS/COFINS, IRPJ/CSLL), geração de arquivos SPED (ECD,
                    ECF, EFD-ICMS, EFD-Contribuições), validação prévia de layout e gestão de
                    parcelamentos PAR/PER-DCOMP.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">
                  Tela: /fiscal e /empresas/:id (Guias)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Estruturar a escrituração fiscal digital com checagem rigorosa de blocos (0, C, D,
                  E, I, J, 9), gerar arquivos TXT com hash MD5 e controlar guias de recolhimento
                  prevenindo juros e rescisão de acordos fiscais.
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Auxiliar gera e valida arquivos de prévia; Contador ou Administrador assina
                  digitalmente no PVA e registra o recibo oficial.
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Roteiro de Escrituração SPED:
                </h3>
                <ol className="list-decimal pl-4 space-y-2">
                  <li>
                    <b>Acesso à Aba Escrituração SPED:</b> No módulo Fiscal, selecione a empresa e o
                    tipo de SPED desejado (ECD Contábil, ECF Fiscal, EFD-ICMS/IPI ou
                    EFD-Contribuições).
                  </li>
                  <li>
                    <b>Validação de Prévia de Estrutura:</b> A plataforma checa a existência dos
                    blocos essenciais, coerência de inscrição municipal/estadual e preenchimento dos
                    registros de abertura e encerramento antes de disponibilizar o arquivo TXT.
                  </li>
                  <li>
                    <b>Geração e Hash MD5:</b> O arquivo é gerado com cálculo de hash MD5 imutável
                    gravado no banco de dados para fins de trilha de auditoria e conformidade
                    técnica.
                  </li>
                  <li>
                    <b>Submissão no PVA Oficial:</b> Importe o arquivo gerado no Programa Validador
                    e Assinador (PVA) da Receita Federal para assinatura via certificado digital e
                    transmissão.
                  </li>
                  <li>
                    <b>Registro do Protocolo/Recibo:</b> Na plataforma, cole o número do recibo e a
                    data de entrega. O status muda automaticamente para <i>Transmitido</i> e o
                    documento é arquivado no GED.
                  </li>
                </ol>
              </div>

              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Gestão de Guias & Parcelamentos PAR / PER-DCOMP:
                </h3>
                <p>
                  Na aba <i>Guias & Pagamentos</i> da empresa, a Elliza organiza os DARFs e
                  parcelamentos federais (PERT, Transação Tributária PGFN e Parcelamento Ordinário).
                  O job diário das 08h fiscaliza as datas de vencimento de parcelas e aciona alertas
                  com 7 dias de antecedência para evitar rescisão do benefício fiscal.
                </p>
              </div>

              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                <div className="flex items-center gap-2 font-semibold text-teal-900 mb-1">
                  <UserCheck className="h-4 w-4 text-[#0FA3A3]" />
                  Ponto de Aprovação Humana Obrigatório:
                </div>
                <p className="text-slate-600">
                  Nenhum arquivo SPED pode ser considerado transmitido sem que o Contador anexe o
                  número do recibo oficial gerado pelo PVA da Receita Federal.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 4: ROTINA CONTÁBIL & FECHO
           ========================================================================= */}
        <TabsContent value="contabil" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 04: Rotina Contábil, Conciliação & Fecho Mensal
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Importação de extratos OFX/CSV, conciliação bancária assistida, pré-lançamentos
                    de IA e fechamento com trava retroativa.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">
                  Tela: /contabil/lancamentos e /fecho-mensal
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Garantir partidas dobradas equilibradas (Débito = Crédito), conciliar o saldo do
                  razão com o extrato bancário e trancar o período contábil prevenindo alterações
                  extemporâneas não autorizadas.
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Auxiliar concilia extratos e aceita pré-lançamentos de alta confiança; Fechamento
                  e reabertura de competência são exclusivos do Contador.
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Trava Retroativa do Fecho Contábil:
                </h3>
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <div className="flex items-center gap-2 font-semibold text-amber-900 mb-1">
                    <Lock className="h-4 w-4 text-amber-600" />
                    Regra do Hook de Banco (validate_lancamento_competencia_fechada):
                  </div>
                  <p className="text-slate-600">
                    Uma vez que a competência é marcada como <b>Fechada</b> na tela{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded">/fecho-mensal</code>, o
                    backend do Skip Cloud <b>rejeita qualquer inserção, edição ou exclusão</b> de
                    lançamentos contábeis naquela competência. Caso seja necessária uma retificação,
                    o Contador deve executar o procedimento formal de Reabertura com registro de
                    motivo obrigatório na Trilha de Auditoria.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Passos da Conciliação e Pré-Lançamento:
                </h3>
                <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                  <li>Importe o extrato bancário (OFX ou CSV) no módulo Financeiro/Contábil.</li>
                  <li>
                    A Elliza cruza as descrições bancárias com as regras do <i>Mapeamento Fecho</i>{' '}
                    e títulos em aberto.
                  </li>
                  <li>
                    Na aba <i>Pré-Lançamentos</i>, itens com score de confiança ≥ 85% são
                    sinalizados em verde para aprovação em bloco.
                  </li>
                  <li>
                    Ao fechar o mês, execute o checklist automático (9 itens padrão: extratos,
                    folha, depreciação, impostos retidos e apurações).
                  </li>
                </ol>
              </div>

              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                <div className="flex items-center gap-2 font-semibold text-teal-900 mb-1">
                  <UserCheck className="h-4 w-4 text-[#0FA3A3]" />
                  Ponto de Aprovação Humana Obrigatório:
                </div>
                <p className="text-slate-600">
                  A homologação do Fecho Mensal e a emissão do Balancete de Verificação / DRE exigem
                  assinatura técnica do Contador.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 5: ATENDIMENTO WHATSAPP & NFS-E
           ========================================================================= */}
        <TabsContent value="whatsapp_nfse" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 05: Atendimento WhatsApp & Emissão de NFS-e
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Operação do Agente de IA nativo no WhatsApp, supervisão de diálogos,
                    escalonamento para humano, emissão de NFS-e (Gov.br / Betha / Ginfes),
                    cancelamento e substituição de notas.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">Tela: /nfse-whatsapp</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Prestar atendimento ágil via WhatsApp aos tomadores e clientes, esclarecer dúvidas
                  pontuais com segurança, capturar solicitações de notas de serviço e submeter
                  minutas estruturadas para aprovação contábil.
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Agente IA atende em modo supervisionado; Emissão de NFS-e com efeitos tributários
                  é restrita a Contador ou Administrador.
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Regras do Agente IA no WhatsApp:
                </h3>
                <ul className="space-y-2">
                  <li className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <b>1. Modo Supervisionado como Padrão:</b> Toda resposta do bot passa pela caixa
                    de supervisão. Caso a dúvida seja complexa ou envolva ato fiscal (ex.: cálculo
                    de retenção ou pedido de nota), o robô realiza o escalonamento automático (
                    <Badge variant="outline" className="text-amber-800">
                      escalada_humano
                    </Badge>
                    ) e notifica o contador.
                  </li>
                  <li className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <b>2. Captura & Extração Cognitiva de NFS-e:</b> Quando o cliente envia um texto
                    como <i>"Emita uma nota para a Acme no valor de R$ 3.500"</i>, o motor cognitivo
                    extrai Razão Social, CNPJ, valor e atividade municipal, preenchendo a
                    solicitação em status <Badge variant="outline">em_analise</Badge>.
                  </li>
                  <li className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <b>3. Emissão Assistiva:</b> O contador abre a tela de revisão, audita a
                    alíquota de ISS e o código de serviço IBGE, e clica em <i>Aprovar e Emitir</i>.
                    O sistema despacha via Gov.br, Betha ou Ginfes (ou modo simulação seguro), gera
                    o DANFSE e o XML, e envia o comprovante de volta no WhatsApp do cliente.
                  </li>
                  <li className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <b>4. Cancelamento & Substituição:</b> Caso haja erro na nota, o procedimento de
                    cancelamento exige seleção do código oficial (ex.: erro de emissão / serviço não
                    prestado) e justificativa formal. Para substituição, a plataforma gera a nova
                    nota vinculando os IDs e registrando no GED.
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                <div className="flex items-center gap-2 font-semibold text-teal-900 mb-1">
                  <UserCheck className="h-4 w-4 text-[#0FA3A3]" />
                  Ponto de Aprovação Humana Obrigatório:
                </div>
                <p className="text-slate-600">
                  O bot do WhatsApp é expressamente proibido de transmitir notas fiscais diretamente
                  para as Secretarias de Fazenda ou Prefeituras sem prévia revisão humana no painel
                  da plataforma.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 6: OBRIGAÇÕES, PRAZOS & JOB DAS 08H
           ========================================================================= */}
        <TabsContent value="obrigacoes_prazos" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 06: Obrigações Acessórias, Calendário & Job Diário das 08h
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Varredura automatizada agendada (cron daily_obrigacoes_reminder), alertas
                    antecipados e prevenção de penalidades.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">Tela: /obrigacoes</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Evitar preclusão de prazos e multas por atraso nas obrigações fiscais e
                  trabalhistas de toda a carteira de clientes.
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    ⚙️ Automação Programada:
                  </span>
                  Job diário executado pontualmente às 08:00 UTC (cronAdd daily_obrigacoes_reminder)
                  com anti-flood de 20 horas.
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Escopo da Varredura Diária das 08h:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-semibold text-slate-900 block">
                      1. Obrigações Gerais & Impostos Retidos:
                    </span>
                    Verifica obrigações com vencimento em até 7 dias ou vencidas (DAS, DARF, DCTF,
                    GIA). Dispara notificações in-app e e-mails.
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-semibold text-slate-900 block">
                      2. Fila e-Social, Reinf & DCTFWeb:
                    </span>
                    Audita prazos do dia 15 (EFD-Reinf) e dia 25 (DCTFWeb), alertando a equipe para
                    eventos que ainda estejam em status pendente.
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-semibold text-slate-900 block">
                      3. Certificados Digitais A1:
                    </span>
                    Varre certificados com expiração prevista para os próximos 30 dias ou expirados,
                    orientando a renovação preventiva.
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-semibold text-slate-900 block">
                      4. Certidões Negativas (CND) & PAR:
                    </span>
                    Fiscaliza validades de CNDs Federal/Estadual/Municipal e parcelas de acordos
                    fiscais com a Receita Federal.
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="font-semibold text-slate-900 block mb-1">
                  Proteção Anti-Flood:
                </span>
                <p className="text-slate-600">
                  Para não sobrecarregar os operadores da Elliza e os clientes, o motor de
                  agendamento consulta o histórico recente antes de gerar novas notificações. Caso
                  já tenha ocorrido aviso nas últimas 20 horas para o mesmo fato, a notificação
                  adicional é suprimida.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 7: MONITORAMENTO & REFORMA TRIBUTÁRIA
           ========================================================================= */}
        <TabsContent value="monitoramento_cnd" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 07: Monitoramento CND, Conector RFB & Reforma Tributária
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Varredura da caixa postal DTE, certidões negativas, radar de publicações
                    legislativas diárias e Simulador da Reforma (EC 132/23 e LC 214/25).
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">
                  Tela: /simulador-reforma e /monitoramento-legislativo
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Manter as empresas da carteira 100% regulares perante os fiscos federal, estadual
                  e municipal, antecipando intimações do e-CAC e fornecendo consultoria estratégica
                  sobre os impactos da transição tributária 2026–2033.
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Todos os perfis técnicos podem consultar diagnósticos; Consultores e Contadores
                  geram apresentações executivas para clientes.
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Módulos de Inteligência Fiscal:
                </h3>
                <ul className="space-y-2">
                  <li className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <b>• Conector RFB & Caixa Postal DTE:</b> Sincronização automática com a caixa
                    postal do e-CAC. Intimações são catalogadas com nível de criticidade (Alta,
                    Média, Baixa) e prazos de resposta registrados no calendário.
                  </li>
                  <li className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <b>• Radar Legislativo Diário:</b> Monitoramento do Diário Oficial da União
                    (DOU) e atos do Comitê Gestor do IBS. Publicações de alta criticidade geram
                    alerta imediato no dashboard contábil.
                  </li>
                  <li className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <b>• Simulador da Reforma Tributária (IBS/CBS):</b> Análise de impacto setor a
                    setor, comparando a carga atual (PIS, COFINS, ISS, ICMS) com o regime dual (CBS
                    8,8% + IBS 17,7% = 26,5%), regimes favorecidos (redução de 60% para saúde e
                    educação) e regime específico para Simples Nacional. O job trimestral grava
                    snapshot do ranking da carteira.
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                <div className="flex items-center gap-2 font-semibold text-teal-900 mb-1">
                  <Award className="h-4 w-4 text-[#0FA3A3]" />
                  Avisos de Simulação & Governança (NBC PG 01):
                </div>
                <p className="text-slate-600">
                  Os relatórios do Simulador da Reforma possuem advertência expressa de que se
                  tratam de projeções cenarizadas baseadas no texto da Emenda Constitucional nº
                  132/2023 e no Projeto de Lei Complementar nº 214/2025, não constituindo
                  aconselhamento jurídico vinculante sem chancela formal do Contador.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 8: ABERTURA DE EMPRESA (NOVO PROCEDIMENTO 08)
           ========================================================================= */}
        <TabsContent value="abertura" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 08: Abertura de Empresa & Legalização Societária
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Workflows simultâneos de legalização, link público autoatendimento de 3 passos,
                    Kanban regulatório e exclusão controlada de anexos e dados.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">
                  Tela: Empresas → aba "Abertura de Empresa"
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Conduzir processos de abertura societária (SLU, LTDA, S/A, MEI) de forma ágil e
                  transparente, permitindo que múltiplos sócios preencham seus dados remotamente
                  enquanto o escritório acompanha cada etapa regulatória via Kanban visual.
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Auxiliar cria workflows e gera links públicos; Contador ou Administrador revisa e
                  aprova os dados societários para protocolização na Junta Comercial/Redesim.
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Passo a Passo Operacional:
                </h3>
                <ol className="list-decimal pl-4 space-y-2">
                  <li>
                    <b>Criação do Workflow:</b> Na aba <i>Abertura de Empresa</i> em{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded">/empresas</code>, clique em{' '}
                    <i>Novo Processo de Abertura</i>. Defina a razão social pretendida, natureza
                    jurídica (ex.: Sociedade Limitada, SLU) e o responsável operacional.
                  </li>
                  <li>
                    <b>Geração do Link Público para o Cliente:</b> Acione o botão{' '}
                    <i>Gerar Link Público</i>. O sistema cria um token único seguro com link
                    amigável (rota{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded">
                      /abertura-cliente/:token
                    </code>
                    ) para compartilhamento via WhatsApp ou e-mail.
                  </li>
                  <li>
                    <b>Preenchimento em 3 Passos pelo Cliente:</b>
                    <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-600">
                      <li>
                        <b>Passo 1 — Dados Básicos & Atividades:</b> 3 opções de nomes empresariais,
                        objeto social preliminar e porte almejado.
                      </li>
                      <li>
                        <b>Passo 2 — Quadro Societário (QSA):</b> Cadastro dos sócios, qualificação,
                        percentual de quotas e upload de documentos (RG/CNH, comprovante de
                        residência).
                      </li>
                      <li>
                        <b>Passo 3 — Endereço & Viabilidade:</b> IPTU/Inscrição Imobiliária,
                        metragem, estabelecimento físico x ponto de contato e revisão final com
                        envio.
                      </li>
                    </ul>
                  </li>
                  <li>
                    <b>Acompanhamento no Kanban Regulatório:</b> No painel interno, o workflow
                    progride pelas colunas visuais: <i>Coleta com Cliente</i> →{' '}
                    <i>Viabilidade & DBE</i> → <i>Elaboração de Contrato</i> →{' '}
                    <i>Junta Comercial / Cartório</i> → <i>Inscrição Municipal / Alvará</i> →{' '}
                    <i>Concluído</i>.
                  </li>
                  <li>
                    <b>Exclusão Segura de Anexos e Workflows:</b> Documentos descartados ou
                    workflows cancelados podem ser removidos individualmente com expurgo permanente
                    do storage, garantindo compliance LGPD para propostas não formalizadas.
                  </li>
                </ol>
              </div>

              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                <div className="flex items-center gap-2 font-semibold text-teal-900 mb-1">
                  <UserCheck className="h-4 w-4 text-[#0FA3A3]" />
                  Ponto de Aprovação Humana Obrigatório:
                </div>
                <p className="text-slate-600">
                  Antes de gerar a FCPJ/DBE no portal Redesim ou minutar o Contrato Social
                  definitivo, o Contador deve conferir o enquadramento do CNAE principal x
                  impedimentos do Simples Nacional e as exigências específicas de conselhos de
                  classe (CRM, CREA, OAB, CRO).
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <div className="flex items-center gap-2 font-semibold text-amber-900 mb-1">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Regra de Supervisão & Integração Externa:
                </div>
                <p className="text-slate-600">
                  Sistemas de Juntas Comerciais estaduais (JUCESP, JUCEPAR, JUCERJA) não possuem
                  APIs universais de protocolo direto. A Elliza consolida os dados e minuta os
                  termos; o protocolo do processo é realizado sob <b>Modo Supervisão</b> pelo
                  despachante ou técnico contábil com certificado digital ICP-Brasil.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 9: MIGRAÇÕES & ONBOARDING (NOVO PROCEDIMENTO 09)
           ========================================================================= */}
        <TabsContent value="migracoes" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Boxes className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 09: Migrações de Escritório (Entrada & Saída) & Handover CRC
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Rastreamento 360° de transição de responsabilidade técnica: acolhimento de
                    entrada, auditoria de saldos, checklists de saída e proteção jurídica
                    ético-disciplinar.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">
                  Tela: /empresas (aba Migrações) e Ficha da Empresa
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Padronizar o processo bidirecional de transferência de empresas: <b>
                    ENTRADA
                  </b>{' '}
                  (acolhimento, coleta do escritório anterior e implantação dos saldos) e{' '}
                  <b>SAÍDA</b> (handover transparente, entrega de livros fiscais/contábeis e
                  desvinculação formal).
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Auxiliar checa itens operacionais; Contador Responsável assina o Termo de
                  Transferência de Responsabilidade Técnica perante o CRC.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* Migração de Entrada */}
                <div className="space-y-2 rounded-xl border border-teal-200 bg-teal-50/30 p-4">
                  <div className="flex items-center gap-2 text-teal-900 font-bold text-xs uppercase tracking-wide">
                    <Badge className="bg-[#0FA3A3] text-white text-[10px]">MIGRAÇÃO ENTRADA</Badge>
                    <span>Checklist de Acolhimento</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                    <li>
                      <b>Termo de Transferência:</b> Notificação formal ao contador anterior com
                      base no Código de Ética do CRC.
                    </li>
                    <li>
                      <b>Procurações Eletrônicas:</b> Estabelecer procuração e-CAC RFB e
                      Conectividade Social ICP para o CNPJ do escritório.
                    </li>
                    <li>
                      <b>Coleta de Arquivos Históricos:</b> ECDs/ECFs dos últimos 5 anos, folhas de
                      pagamento recentes, tabela de rubricas do e-Social e guias DCTFWeb/FGTS.
                    </li>
                    <li>
                      <b>Cofre de Certificado A1:</b> Upload do .pfx e validação imediata da chave.
                    </li>
                    <li>
                      <b>Data de Corte & Primeira Competência:</b> Definição expressa do primeiro
                      mês sob responsabilidade do novo escritório.
                    </li>
                    <li>
                      <b>Saldos Iniciais:</b> Digitação/importação do balanço de encerramento do
                      período anterior para continuidade das partidas dobradas.
                    </li>
                  </ol>
                </div>

                {/* Migração de Saída */}
                <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/30 p-4">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wide">
                    <Badge className="bg-amber-600 text-white text-[10px]">MIGRAÇÃO SAÍDA</Badge>
                    <span>Handover & Desvinculação</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                    <li>
                      <b>Competências Transmitidas:</b> Listar explicitamente todas as obrigações
                      cumpridas até a data de rescisão.
                    </li>
                    <li>
                      <b>Pacote de Entrega de Arquivos:</b> Speds (ECD/ECF/EFD), DREs, balancetes,
                      fichas financeiras de colaboradores e guias pagas/parceladas.
                    </li>
                    <li>
                      <b>Termo CRC de Transferência:</b> Emissão do documento formal de passagem com
                      chancela do novo responsável técnico.
                    </li>
                    <li>
                      <b>Revogação de Procurações:</b> Cancelamento das procurações e-CAC e Caixa
                      para cessar solidariedade técnica.
                    </li>
                    <li>
                      <b>Cancelamento de Acessos:</b> Desativação do portal do cliente, extensões e
                      bloqueio de movimentações futuras.
                    </li>
                  </ol>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Visualização da Carteira & Badges:
                </h3>
                <p>
                  As empresas em processo de migração exibem etiquetas coloridas na lista geral (
                  <Badge className="bg-teal-700 text-white text-[10px]">MIGRAÇÃO ENTRADA</Badge> e{' '}
                  <Badge className="bg-amber-700 text-white text-[10px]">MIGRAÇÃO SAÍDA</Badge>). O
                  painel permite filtrar por status (<i>Em Andamento</i>, <i>Concluído</i> ou{' '}
                  <i>Cancelado</i>) e exportar o protocolo final com data/hora e assinaturas.
                </p>
              </div>

              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                <div className="flex items-center gap-2 font-semibold text-teal-900 mb-1">
                  <UserCheck className="h-4 w-4 text-[#0FA3A3]" />
                  Ponto de Aprovação Humana Obrigatório:
                </div>
                <p className="text-slate-600">
                  A conclusão de um processo de migração (seja entrada ou saída) exige confirmação
                  manual do Contador Titular, certificando que nenhum prazo ou débito ficou
                  descoberto entre o período de encerramento do antigo contador e o início do novo.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 10: PAINEL DE INTEGRAÇÃO DO TRIPÉ (NOVO PROCEDIMENTO 10)
           ========================================================================= */}
        <TabsContent value="tripe" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Network className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 10: Painel de Integração do Tripé Contábil & Lotes Automáticos
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Diagnóstico dos 4 elos por competência: DP → Fiscal → Partidas Dobradas →
                    Obrigações, detecção de elo quebrado e geração assistida de lotes.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">Tela: /integracao (menu Contábil)</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Garantir que a operação contábil não trabalhe em silos isolados. O Tripé audita a
                  consistência contínua entre a Folha de Pagamento, as Apurações Tributárias, os
                  Lançamentos Contábeis em Partidas Dobradas e a Transmissão das Obrigações.
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Auxiliar Contábil/Fiscal visualiza inconsistências e gera rascunhos de lotes;
                  Contador efetiva a consolidação e trava a competência.
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Os 4 Elos do Diagnóstico Integrado:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="font-bold text-[#0FA3A3] block text-xs">Elo 1: DP</span>
                    <span className="font-semibold text-slate-800">Folha Processada</span>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Eventos CLT calculados, provisão de férias/13º e encargos consolidados.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="font-bold text-[#0FA3A3] block text-xs">Elo 2: Fiscal</span>
                    <span className="font-semibold text-slate-800">Tributos Apurados</span>
                    <p className="text-[10px] text-slate-500 mt-1">
                      DAS, DARFs, PIS/COFINS, ISS e retenções apurados com guias geradas.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="font-bold text-[#0FA3A3] block text-xs">Elo 3: Contábil</span>
                    <span className="font-semibold text-slate-800">Partidas Dobradas</span>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Lote contábil gerado com Débito = Crédito sem contas suspensas.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="font-bold text-[#0FA3A3] block text-xs">
                      Elo 4: Obrigações
                    </span>
                    <span className="font-semibold text-slate-800">Transmissão Fisco</span>
                    <p className="text-[10px] text-slate-500 mt-1">
                      e-Social fechado, DCTFWeb, Reinf e SPED protocolados com recibo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Integração Automática & Padrão de Nomenclatura dos Lotes:
                </h3>
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-teal-50/50 border border-teal-200 text-slate-700">
                    <b>• Folha Processada → LOTE-FOLHA:</b> Quando a folha é finalizada no DP, o
                    sistema oferece geração em 1 clique (ou automática) do lote{' '}
                    <code className="bg-white px-1.5 py-0.5 rounded text-[#0FA3A3] font-bold">
                      LOTE-FOLHA-[COMPETÊNCIA]-[EMPRESA]
                    </code>
                    , debitando despesas com salários/INSS/FGTS e creditando obrigações sociais a
                    pagar.
                  </div>
                  <div className="p-2.5 rounded-lg bg-teal-50/50 border border-teal-200 text-slate-700">
                    <b>• Guia Fiscal Emitida → LOTE-FISC:</b> Cada apuração concluída no módulo
                    fiscal gera a provisão contábil do imposto{' '}
                    <code className="bg-white px-1.5 py-0.5 rounded text-[#0FA3A3] font-bold">
                      LOTE-FISC-[TRIBUTO]-[COMPETÊNCIA]
                    </code>
                    , debitando redutoras de receita e creditando tributos a recolher.
                  </div>
                  <div className="p-2.5 rounded-lg bg-teal-50/50 border border-teal-200 text-slate-700">
                    <b>• Baixa de Guia com Comprovante → LOTE-LIQ:</b> Ao dar baixa no pagamento da
                    guia (via extrato bancário ou baixa manual), é gerado o lote de liquidação{' '}
                    <code className="bg-white px-1.5 py-0.5 rounded text-[#0FA3A3] font-bold">
                      LOTE-LIQ-[ID_GUIA]
                    </code>
                    , debitando o passivo circulante e creditando a conta Caixa/Bancos.
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-3">
                <div className="flex items-center gap-2 font-semibold text-rose-900 mb-1">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  Banner do Elo Quebrado & Ação Sugerida:
                </div>
                <p className="text-slate-700">
                  Sempre que um dos 4 elos apresentar inconsistência (por exemplo: folha fechada no
                  DP, mas sem lote contábil gerado; ou imposto apurado no fiscal sem a
                  correspondente guia provisada no contábil), a tela{' '}
                  <code className="bg-white px-1 rounded">/integracao</code> exibe o banner de
                  advertência com o diagnóstico exato e o botão de ação imediata (ex.:{' '}
                  <i>"Gerar Lote Contábil da Folha Agora"</i>).
                </p>
              </div>

              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                <div className="flex items-center gap-2 font-semibold text-teal-900 mb-1">
                  <UserCheck className="h-4 w-4 text-[#0FA3A3]" />
                  Ponto de Aprovação Humana Obrigatório:
                </div>
                <p className="text-slate-600">
                  Os lotes gerados automaticamente entram em status de pré-lançamento contábil.
                  Apenas após a conferência das contas de contrapartida pelo Contador os lotes são
                  efetivados no Livro Diário da empresa.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 11: FISCAL - DEFIS & IMPORTAÇÃO XML (NOVO PROCEDIMENTO 11)
           ========================================================================= */}
        <TabsContent value="defis_xml" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileUp className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 11: DEFIS & Importação de XML Fiscal em Lote
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Declaração Anual do Simples Nacional em 4 abas, exportação TXT oficial RFB e
                    captura em lote de notas fiscais com isolamento de falha por arquivo.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">
                  Tela: /fiscal/defis e /fiscal (Importar XML)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Automatizar a montagem da DEFIS anual cruzando balancete contábil, DRE e folha
                  CLT; e processar centenas de arquivos XML de NF-e e NFS-e simultaneamente com
                  blindagem anti-duplicidade e cascata contábil opcional.
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Auxiliar importa XMLs e audita prévias; Contador valida os 4 blocos da DEFIS e
                  assina a transmissão perante a Receita Federal.
                </div>
              </div>

              {/* Bloco 1: DEFIS */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Badge className="bg-[#0FA3A3] text-white">DEFIS SIMPLES NACIONAL</Badge>
                  <span>Fluxo Operacional da Declaração Anual</span>
                </div>
                <ol className="list-decimal pl-4 space-y-2 text-slate-600">
                  <li>
                    <b>Geração Automática do Rascunho:</b> Acesse a aba <i>DEFIS</i> no módulo
                    Fiscal. Selecione a empresa e o ano-calendário (ex.: 2025/2026). O sistema
                    extrai automaticamente os saldos de caixa/bancos do balanço, o faturamento da
                    DRE, os encargos da folha de pagamento e os dados cadastrais do QSA.
                  </li>
                  <li>
                    <b>Revisão Estruturada em 4 Abas:</b>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>
                        <b>Aba 1 — Valores & Faturamento:</b> Ganhos de capital, saldo inicial e
                        final de disponibilidades, compras de mercadorias e despesas operacionais.
                      </li>
                      <li>
                        <b>Aba 2 — Estoque & Custos (EFC):</b> Estoque inicial, final e custo de
                        mercadorias vendidas/serviços prestados.
                      </li>
                      <li>
                        <b>Aba 3 — Empregados:</b> Média de empregados no início e fim do período,
                        número de admissões e desligamentos computados pelo módulo de DP.
                      </li>
                      <li>
                        <b>Aba 4 — Sócios & QSA:</b> Rendimentos isentos (distribuição de lucros) e
                        rendimentos tributáveis (pró-labore), além do percentual societário.
                      </li>
                    </ul>
                  </li>
                  <li>
                    <b>Exportação do Arquivo TXT Padrão RFB:</b> Clique em{' '}
                    <i>Exportar TXT Oficial</i>. O arquivo gerado cumpre rigorosamente as
                    especificações do layout da Receita Federal para importação no PGDAS-D.
                  </li>
                  <li>
                    <b>Transmissão em Modo Supervisão:</b> A transmissão definitiva exige
                    certificado digital no portal do Simples Nacional. O operador registra o número
                    do recibo oficial no painel, arquivando o protocolo no GED.
                  </li>
                </ol>
              </div>

              {/* Bloco 2: Importação de XML Fiscal em Lote */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Badge className="bg-slate-800 text-white">XML FISCAL EM LOTE</Badge>
                  <span>Drag & Drop, Anti-Duplicidade e Isolamento</span>
                </div>
                <ol className="list-decimal pl-4 space-y-2 text-slate-600">
                  <li>
                    <b>Envio por Drag & Drop:</b> Arraste múltiplos arquivos XML de NF-e (modelo 55)
                    ou NFS-e de qualquer município homologado para a área de importação.
                  </li>
                  <li>
                    <b>Prévia Inteligente de Validação:</b> Antes de persistir, o sistema classifica
                    os arquivos em 3 grupos visuais:
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>
                        <Badge variant="outline" className="text-emerald-700 bg-emerald-50">
                          Prontas para Importar
                        </Badge>
                        : XMLs válidos com dados fiscais completos e chave identificada.
                      </li>
                      <li>
                        <Badge variant="outline" className="text-amber-700 bg-amber-50">
                          Duplicadas Detectadas
                        </Badge>
                        : Arquivos cuja chave de acesso (44 dígitos da NF-e) ou número/série da
                        NFS-e já constam no banco de dados da empresa. O sistema impede a
                        duplicidade de faturamento.
                      </li>
                      <li>
                        <Badge variant="outline" className="text-rose-700 bg-rose-50">
                          Erros de Estrutura
                        </Badge>
                        : Arquivos corrompidos ou com schema incompatível, acompanhados da descrição
                        do erro.
                      </li>
                    </ul>
                  </li>
                  <li>
                    <b>Cascata Contábil Opcional:</b> Marque a opção{' '}
                    <i>"Gerar Lançamentos Contábeis de Provisão"</i> para disparar automaticamente
                    os débitos/créditos de receita ou compras no módulo contábil no mesmo ato da
                    importação fiscal.
                  </li>
                  <li>
                    <b>Isolamento de Falha por Arquivo:</b> Caso um arquivo do lote apresente erro
                    de parse ou chave duplicada, <b>apenas ele é rejeitado</b>, garantindo que os
                    demais arquivos válidos sejam processados e integrados com sucesso.
                  </li>
                </ol>
              </div>

              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                <div className="flex items-center gap-2 font-semibold text-teal-900 mb-1">
                  <UserCheck className="h-4 w-4 text-[#0FA3A3]" />
                  Ponto de Aprovação Humana Obrigatório:
                </div>
                <p className="text-slate-600">
                  A DEFIS consolida os rendimentos dos sócios que alimentarão a DIRPF pessoa física
                  (distribuição de lucros isenta e pró-labore tributável). É obrigatória a
                  conferência técnica do balanço pelo Contador antes de protocolar a declaração no
                  e-CAC.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 12: ROTINAS EM LOTE, PATRIMÔNIO & MOTOR (NOVO PROCEDIMENTO 12)
           ========================================================================= */}
        <TabsContent value="lote_patrimonio" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 12: Rotinas em Lote, Gestão de Patrimônio & Motor de Cálculo
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Execução em massa multi-empresas (/lote), localização física de bens com
                    depreciação e Motor de Cálculo Normativo Centralizado (/parametros-normativos).
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">
                  Telas: /lote, /patrimonio e /parametros-normativos
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Escalar a produtividade do escritório executando rotinas contábeis/fiscais para
                  dezenas de empresas em lote com segurança; gerenciar a vida útil e localização dos
                  ativos imobilizados; e manter uma fonte única da verdade para todas as tabelas
                  normativas vigentes no país.
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Rotinas em Lote e Patrimônio: Contador ou Auxiliar autorizado; Edição do Motor de
                  Cálculo Normativo: estritamente restrita a perfil <b>Administrador</b> com
                  auditoria.
                </div>
              </div>

              {/* Tópico A: Rotinas em Lote Multi-Empresas */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Badge className="bg-[#0FA3A3] text-white">ROTEIRO MULTI-EMPRESAS (/lote)</Badge>
                  <span>Execução Paralela com Isolamento de Falhas</span>
                </div>
                <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                  <li>
                    <b>Seleção da Competência & Empresas:</b> Defina o mês de referência (ex.:{' '}
                    <code className="bg-white px-1 rounded">2026-03</code>) e filtre as empresas
                    desejadas por regime tributário ou selecione toda a carteira.
                  </li>
                  <li>
                    <b>Checklist de Operações Disponíveis:</b> Escolha as operações que serão
                    disparadas:
                    <ul className="list-disc pl-5 mt-1 space-y-0.5">
                      <li>Processamento de Folha CLT e encargos patronais</li>
                      <li>Geração automática do Lote Contábil da Folha</li>
                      <li>Apuração tributária com emissão de guias DAS/DARF</li>
                      <li>Fechamento preliminar de competência contábil</li>
                      <li>Geração dos relatórios DRE e Balancete consolidado</li>
                      <li>Processamento de pacotes de XMLs fiscais</li>
                    </ul>
                  </li>
                  <li>
                    <b>Isolamento de Falha por Empresa:</b> O motor opera empresa por empresa. Se
                    uma empresa falhar por pendência cadastral ou ausência de extrato bancário, o
                    sistema registra a ocorrência, mas{' '}
                    <b>não interrompe a execução das demais empresas</b>.
                  </li>
                  <li>
                    <b>Relatório Consolidado de Execução:</b> Ao final, é gerado um relatório de
                    auditoria com totais de sucessos, alertas e falhas, com download de log em
                    formato estruturado.
                  </li>
                </ol>
              </div>

              {/* Tópico B: Patrimônio e Localização Física */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Badge className="bg-slate-800 text-white">
                    PATRIMÔNIO & IMOBILIZADO (/patrimonio)
                  </Badge>
                  <span>Localização Física, Transferências e Depreciação</span>
                </div>
                <ul className="space-y-1.5 text-slate-600">
                  <li>
                    <b>• Cadastro Completo do Ativo:</b> Número de plaqueta/patrimônio, data de
                    aquisição, valor histórico, valor residual e taxa de depreciação anual (ex.: 20%
                    para veículos, 10% para máquinas e equipamentos, 20% para computadores).
                  </li>
                  <li>
                    <b>• Rastreamento da Localização Física:</b> Vinculação obrigatória do bem a uma{' '}
                    <b>Filial</b>, <b>Setor/Departamento</b> e <b>Colaborador Responsável</b>.
                  </li>
                  <li>
                    <b>• Transferência de Bens com Histórico:</b> O botão <i>Transferir Bem</i>{' '}
                    permite mover o ativo para outro setor ou responsável com justificativa e data
                    de vigência, gravando a trilha histórica para inventário patrimonial.
                  </li>
                  <li>
                    <b>• Cálculo Mensal da Depreciação:</b> Apuração automática da quota mensal com
                    geração de partidas contábeis: Débito em Despesa de Depreciação e Crédito em
                    Depreciação Acumulada (Conta Redutora do Ativo Não Circulante).
                  </li>
                </ul>
              </div>

              {/* Tópico C: Motor de Cálculo Normativo Unificado */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Badge className="bg-emerald-700 text-white">
                    MOTOR NORMATIVO (/parametros-normativos)
                  </Badge>
                  <span>Camada Centralizada e Auditada de Alíquotas e Faixas</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Para eliminar divergências entre módulos, a plataforma conta com uma camada
                  centralizada de regras legais normativas que alimenta simultaneamente o
                  Departamento Pessoal, o Módulo Fiscal e o Planejamento Tributário:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="font-bold text-slate-800 block text-xs">INSS & FGTS</span>
                    <p className="text-[11px] text-slate-600">
                      Tabela progressiva com teto de salário de contribuição e alíquotas patronais.
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="font-bold text-slate-800 block text-xs">IRRF & Deduções</span>
                    <p className="text-[11px] text-slate-600">
                      Faixas progressivas, parcela a deduzir por dependente e desconto simplificado
                      mensal.
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="font-bold text-slate-800 block text-xs">
                      Simples & Lucro Presumido
                    </span>
                    <p className="text-[11px] text-slate-600">
                      Anexos I a V da LC 123, alíquotas nominais/efetivas, presunções de IRPJ/CSLL e
                      ISS.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                <div className="flex items-center gap-2 font-semibold text-teal-900 mb-1">
                  <UserCheck className="h-4 w-4 text-[#0FA3A3]" />
                  Ponto de Aprovação Humana & Trava de Auditoria:
                </div>
                <p className="text-slate-600">
                  Alterações nas tabelas do Motor de Cálculo Normativo só podem ser executadas por
                  usuários com perfil <b>Administrador</b>. Cada modificação gera registro imutável
                  com data/hora, IP e usuário responsável, garantindo rastreabilidade perante
                  auditorias externas e perícias contábeis.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA COMPLEMENTOS: PROCEDIMENTOS RÁPIDOS & MANUAL
           ========================================================================= */}
        <TabsContent value="complementos" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <PackagePlus className="h-5 w-5 text-[#0FA3A3]" />
                    Complementos Operacionais & Integrações Assistidas
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Procedimentos rápidos para importação S-2200, baixa via e-CAC, monitor de CNDs e
                    articulação com o Manual de Ativação.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">Plataforma Contábil SaaS v0.0.83</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Importação S-2200 */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Users className="h-4 w-4 text-[#0FA3A3]" />
                    <span>Importação de Colaboradores via e-Social</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    <b>Onde:</b> Departamento Pessoal → Colaboradores →{' '}
                    <i>"Importar via e-Social"</i>.
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    Permite upload de XMLs de admissão do e-Social (evento <b>S-2200</b>) ou
                    arquivos CSV/JSON. A ferramenta executa prévia estruturada, identifica CPF, PIS,
                    CBO, salário-base e data de admissão, aplicando verificação anti-duplicidade
                    estrita por CPF antes da gravação no banco de dados.
                  </p>
                  <div className="text-[11px] text-teal-800 font-semibold bg-teal-50 p-2 rounded-lg border border-teal-200">
                    Aprovação humana: o operador revisa a lista de prévia antes de clicar em
                    "Concluir Importação".
                  </div>
                </div>

                {/* 2. Baixa Assistida e-CAC */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Lock className="h-4 w-4 text-[#0FA3A3]" />
                    <span>Baixa Assistida de Guias via e-CAC (Modo Supervisão)</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    <b>Onde:</b> Empresa → aba <i>Guias & Pagamentos</i> →{' '}
                    <i>"Buscar Recolhimentos no e-CAC"</i>.
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    A busca automática de comprovantes de arrecadação depende da extensão do
                    navegador ou procuração ativa na RFB. A Elliza opera em <b>Modo Supervisão</b>:
                    captura o extrato de pagamentos, cruza com as guias em aberto no sistema e
                    solicita chancela humana para confirmar a quitação, sem declarar falso sucesso
                    caso a sessão do e-CAC expire.
                  </p>
                  <div className="text-[11px] text-amber-800 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-200">
                    Modo Supervisão: requer credenciais ativas e intervenção humana caso haja
                    captcha ou token gov.br.
                  </div>
                </div>

                {/* 3. Monitor de CNDs no Dashboard */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <ShieldCheck className="h-4 w-4 text-[#0FA3A3]" />
                    <span>Monitor de CNDs no Dashboard Geral</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    <b>Onde:</b> Tela inicial{' '}
                    <code className="bg-white px-1 rounded">/dashboard</code> (Widget Monitor de
                    Certidões Negativas).
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    Painel unificado que exibe a régua de saúde das 4 certidões essenciais de todas
                    as empresas da carteira: <b>Federal/PGFN</b>, <b>Trabalhista (CNDT)</b>,{' '}
                    <b>FGTS (CRF)</b> e <b>Estadual/Municipal</b>. Sinaliza em vermelho certidões
                    com vencimento inferior a 10 dias ou com pendências apontadas pela varredura
                    diária das 08h.
                  </p>
                </div>

                {/* 4. Manual de Ativação Complementar */}
                <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-teal-950">
                    <BookOpen className="h-4 w-4 text-[#0FA3A3]" />
                    <span>Manual de Ativação Complementar (/manual)</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    O <b>POP de Treinamento</b> (/pop-treinamento) estabelece as diretrizes
                    procedimentais, responsabilidades éticas e normas técnicas da operação contábil.
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    Como complemento de referência rápida no dia a dia, a plataforma disponibiliza o{' '}
                    <b>Manual de Ativação</b> na rota{' '}
                    <Link to="/manual" className="font-bold text-[#0FA3A3] underline">
                      /manual
                    </Link>
                    , com guias visuais passo a passo para configuração de certificado A1, webhook
                    de WhatsApp, extensão de navegador e parametrização fiscal inicial.
                  </p>
                  <Link to="/manual">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-teal-300 text-teal-800 gap-1.5 mt-1"
                    >
                      <span>Abrir Manual de Ativação</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA FICHA DE HABILITAÇÃO OPERACIONAL
           ========================================================================= */}
        <TabsContent value="ficha_habilitacao" className="space-y-6">
          <Card className="border-teal-300 shadow-sm bg-white">
            <CardHeader className="border-b border-teal-100 bg-teal-50/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-teal-950 flex items-center gap-2">
                    <Award className="h-5 w-5 text-[#0FA3A3]" />
                    Ficha de Treinamento & Habilitação Operacional — Elliza Contábil
                  </CardTitle>
                  <CardDescription className="text-xs text-teal-800">
                    Documento comprobatório de capacitação técnica da equipe e certificação do robô
                    de automação (Synapse Robotics) — Versão 0.0.83.
                  </CardDescription>
                </div>
                <Badge className="bg-[#0FA3A3] text-white">Validade: 12 Meses</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Identificação das Partes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Operador / Agente Treinado:
                  </label>
                  <Input
                    value={operadorNome}
                    onChange={(e) => setOperadorNome(e.target.value)}
                    disabled={isReadOnly}
                    className="text-xs h-9 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Supervisor Técnico (CFC):
                  </label>
                  <Input
                    value={supervisorNome}
                    onChange={(e) => setSupervisorNome(e.target.value)}
                    disabled={isReadOnly}
                    className="text-xs h-9 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Data da Conclusão:
                  </label>
                  <Input
                    type="date"
                    value={dataTreinamento}
                    onChange={(e) => setDataTreinamento(e.target.value)}
                    disabled={isReadOnly}
                    className="text-xs h-9 bg-slate-50"
                  />
                </div>
              </div>

              {/* Checklist de Competências Práticas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Checklist de Habilitação por Módulo (12 Procedimentos + Complementos):
                  </h3>
                  <span className="text-xs text-slate-500">
                    {checklistHabilitacao.filter((c) => c.checked).length} de{' '}
                    {checklistHabilitacao.length} validados
                  </span>
                </div>

                <div className="space-y-2">
                  {checklistHabilitacao.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleChecklist(item.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                        item.checked
                          ? 'border-teal-200 bg-teal-50/40 text-slate-800'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => {}}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0FA3A3] focus:ring-[#0FA3A3]"
                      />
                      <div className="flex-1">
                        <span
                          className={`font-medium ${item.checked ? 'text-slate-900' : 'text-slate-600'}`}
                        >
                          {item.label}
                        </span>
                      </div>
                      {item.checked && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Termo de Compromisso */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
                <p className="font-semibold text-slate-900">
                  Declaração de Conformidade & Ética Profissional:
                </p>
                <p className="leading-relaxed">
                  Declaro que a operação do agente <b>Elliza Contábil (Synapse Robotics)</b> foi
                  devidamente instruída conforme os Procedimentos Operacionais Padrão (POP)
                  descritos neste manual, compreendendo os 12 procedimentos operacionais e seus
                  complementos assistivos. Fica expressamente reconhecido que a tecnologia atua em
                  regime <b>estritamente assistivo</b> sob supervisão humana contínua, respeitando a
                  soberania da aprovação contábil prévia, os ditames da Lei Geral de Proteção de
                  Dados (LGPD) e as normas do Conselho Federal de Contabilidade.
                </p>
              </div>

              {/* Assinaturas Digitais e Chancelas */}
              <div className="pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
                <div className="space-y-1">
                  <div className="border-b border-slate-400 pb-2 font-semibold text-slate-800">
                    {operadorNome}
                  </div>
                  <span className="text-[11px] text-slate-500 uppercase">
                    Operador / Responsável pela Automação (Synapse Robotics)
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="border-b border-slate-400 pb-2 font-semibold text-slate-800">
                    {supervisorNome} — {tenant?.crc_responsavel || 'CRC/PR nº 066013/O'}
                  </div>
                  <span className="text-[11px] text-slate-500 uppercase">
                    Contador Responsável Técnico (NBC PP 01 / NBC PG 01)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

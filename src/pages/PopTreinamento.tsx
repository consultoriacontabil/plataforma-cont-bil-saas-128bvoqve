import { useState } from 'react'
import {
  BookOpen,
  Bot,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Printer,
  ChevronRight,
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
  Briefcase,
  Search,
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
      label: 'Onboarding: Busca CNPJ, migração de planilha e guarda de certificado A1',
      checked: true,
    },
    {
      id: 'dp_folha',
      label: 'DP: Ciclo mensal de folha (verbas → cálculo CLT → e-Social S-1200/S-1299)',
      checked: true,
    },
    {
      id: 'dp_reinf',
      label: 'DP & Tributário: EFD-Reinf (R-2010/R-2099) e consolidação da DCTFWeb',
      checked: true,
    },
    {
      id: 'dp_convencoes',
      label: 'DP: Monitoramento de CCTs com aplicação de reajuste salarial em 1 clique',
      checked: true,
    },
    {
      id: 'fiscal_sped',
      label: 'Fiscal: Apurações tributárias, validação PVA e geração SPED (ECD/ECF/EFD)',
      checked: true,
    },
    {
      id: 'fiscal_guias',
      label: 'Fiscal: Baixas de guias DAS/DARF e extratos de parcelamento PAR/PER-DCOMP',
      checked: true,
    },
    {
      id: 'contabil_fecho',
      label: 'Contábil: Conciliação bancária, lançamentos e Fecho Mensal com trava retroativa',
      checked: true,
    },
    {
      id: 'whatsapp_ia',
      label: 'Atendimento WhatsApp: Agente IA em Modo Supervisionado com escala humana',
      checked: true,
    },
    {
      id: 'nfse_aprovacao',
      label: 'NFS-e: Padrão assistivo obrigatório (robô prepara minuta, contador aprova e assina)',
      checked: true,
    },
    {
      id: 'monitoramento',
      label: 'Monitoramento: Varredura diária das 08h (CNDs, E-CAC, Legislação e Reforma EC 132)',
      checked: true,
    },
    {
      id: 'regras_ouro',
      label: 'Regras Inegociáveis: Zero alucinação, isolamento multi-tenant e sigilo LGPD',
      checked: true,
    },
  ])

  const [activeTab, setActiveTab] = useState('visao_geral')
  const [searchTerm, setSearchTerm] = useState('')

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
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-[#0FA3A3] text-white">POP-ELLIZA-2026.1</Badge>
            <Badge variant="outline" className="text-slate-600">
              Versão 1.0.40 • NBC PP 01 & NBC PG 01
            </Badge>
            <Badge className="bg-emerald-600 text-white">Modo Supervisionado</Badge>
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
            na Plataforma Rumo.
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Imprimir / Salvar PDF
          </Button>
          {!isReadOnly && (
            <Button
              onClick={handleSalvarFicha}
              className="bg-[#0FA3A3] hover:bg-[#0c8282] text-white flex items-center gap-2"
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
              protocolo de e-Social/Reinf/DCTFWeb, emissão de NFS-e ou alteração de folha) é
              concluído sem chancela técnica de usuário habilitado (Contador/Administrador),
              garantindo conformidade estrita com o Conselho Federal de Contabilidade (CFC).
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Busca de Procedimentos */}
      <div className="relative print:hidden">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Filtrar tópicos do POP (ex.: e-Social, SPED, NFS-e, CND, rescisão, alucinação)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-10 bg-white border-slate-200 text-sm"
        />
      </div>

      {/* Navegação por Abas do POP */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 p-1 flex flex-wrap h-auto gap-1 border border-slate-200 print:hidden">
          <TabsTrigger value="visao_geral" className="text-xs font-medium">
            Visão Geral & Regras
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="text-xs font-medium">
            1. Onboarding
          </TabsTrigger>
          <TabsTrigger value="dp" className="text-xs font-medium">
            2. Rotina DP & e-Social
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="text-xs font-medium">
            3. Rotina Fiscal & SPED
          </TabsTrigger>
          <TabsTrigger value="contabil" className="text-xs font-medium">
            4. Rotina Contábil & Fecho
          </TabsTrigger>
          <TabsTrigger value="whatsapp_nfse" className="text-xs font-medium">
            5. Atendimento & NFS-e
          </TabsTrigger>
          <TabsTrigger value="obrigacoes_prazos" className="text-xs font-medium">
            6. Prazos & Job 08h
          </TabsTrigger>
          <TabsTrigger value="monitoramento_cnd" className="text-xs font-medium">
            7. Monitoramento & Reforma
          </TabsTrigger>
          <TabsTrigger
            value="ficha_habilitacao"
            className="text-xs font-medium bg-teal-100/60 text-teal-900"
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
                    A Elliza gera o XML de fechamento do e-Social, a escrituração do SPED e a minuta
                    da NFS-e. Contudo, o botão de transmissão externa exige clique explícito de um
                    usuário com perfil Contador ou Administrador.
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
            ABA 8: FICHA DE TREINAMENTO E HABILITAÇÃO OPERACIONAL
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
                    de automação (Synapse Robotics).
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
                    Checklist de Habilitação por Módulo:
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
                  descritos neste manual. Fica expressamente reconhecido que a tecnologia atua em
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

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
  Database,
  Radio,
  FileCheck2,
  FileCode2,
  HardDrive,
  KeyRound,
  History,
  ShieldAlert,
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
      label:
        '01. Onboarding: Busca CNPJ, migração de planilha, guarda de A1 e upload de documentos no GED',
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
      label:
        '07. Radar & Conector RFB: Transparência em modo demonstração, DTE e Simulador Reforma',
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
      id: 'pop13_integra_contador',
      label:
        '13. Integra Contador (SERPRO / e-CAC): Credenciamento, túnel mTLS, autorização cliente 30d, job 04:30 e bilhetagem',
      checked: true,
    },
    {
      id: 'pop14_nfeio',
      label:
        '14. NFS-e Provedor NFE.io: API Key + Company ID, webhook em tempo real e conciliação GED',
      checked: true,
    },
    {
      id: 'pop15_pedidos_documentos',
      label:
        '15. Pedidos de Documentos: 4 tipos fixos, link público, WhatsApp ativo e baixa direta no GED',
      checked: true,
    },
    {
      id: 'pop16_backup_independente',
      label:
        '16. Backup Independente (/backup): Job 03:30 (30 tabelas JSON), GED em lote zipado e retenção 7',
      checked: true,
    },
    {
      id: 'pop17_sped_gerador',
      label:
        '17. SPED Fiscal & Contribuições: EFD-ICMS/IPI (0/C/D/E/H/1) e Contribuições (0/A/C/D/F/M), hash MD5 e PVA',
      checked: true,
    },
    {
      id: 'autonomia_identidade',
      label:
        'Governança ELLIZA: Perfil operacional nativo (elliza_perfil), Painel de Autonomia e Matriz de Credenciais',
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
    if (match('integra contador serpro e-cac mtls proxy consumer key bilhetagem das pgdas')) hits++
    if (match('nfe.io nfeio provedor fiscal webhook cancelamento ged chave api company id')) hits++
    if (match('pedidos documentos extratos maquininhas cartao credito link publico')) hits++
    if (match('backup snapshots download lgpd ged zip manifesto json github retencao')) hits++
    if (match('sped efd icms ipi contribuicoes bloco c bloco a pva md5 sem movimento')) hits++
    if (match('autonomia supervisao credenciais evolution serpro perfil operacional elliza')) hits++
    if (match('upload documento ged arrastar soltar 25mb')) hits++
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
            <Badge className="bg-[#0FA3A3] text-white">POP-ELLIZA-2026.2</Badge>
            <Badge variant="outline" className="text-slate-600">
              Versão 0.0.102 • NBC PP 01 & NBC PG 01
            </Badge>
            <Badge className="bg-emerald-600 text-white">
              Modo Supervisionado & Autonomia Real
            </Badge>
            <Badge
              variant="secondary"
              className="bg-teal-50 text-[#0FA3A3] font-semibold border-teal-200"
            >
              17 Procedimentos Operacionais + Governança & Complementos
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Procedimento Operacional Padrão (POP) & Guia de Treinamento
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manual de Operação Assistiva e Hiperautomação Contábil{' '}
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
              Painel ELLIZA (Diretivas & Autonomia)
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

      {/* Nota de Revisão do Documento (0.0.83 -> 0.0.102) */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-xs text-sky-950 space-y-2">
        <div className="flex items-center gap-2 font-bold text-sky-900">
          <History className="h-4 w-4 text-sky-700" />
          <span>Nota de Revisão — Atualização POP-ELLIZA-2026.2 (Plataforma v0.0.102)</span>
        </div>
        <p className="leading-relaxed">
          Esta revisão incorpora integralmente todas as atualizações tecnológicas e regulatórias
          entregues desde a versão 0.0.83:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-sky-900/90 pt-1">
          <div>
            • <b>Novos Procedimentos 13 a 17:</b> Integra Contador SERPRO/e-CAC com túnel mTLS;
            Provedor fiscal NFE.io; Pedidos de Documentos com link público; Backup independente
            (/backup) com retenção de 7 snapshots e GED zipado; Gerador próprio de SPED Fiscal e
            Contribuições com hash MD5.
          </div>
          <div>
            • <b>Ajustes Estruturais:</b> ELLIZA como perfil operacional próprio (
            <code className="bg-sky-100 px-1 rounded">elliza_perfil</code>); Painel Status de
            Autonomia em <code className="bg-sky-100 px-1 rounded">/elliza</code>; Conector RFB
            honesto em demonstração; Upload com drag & drop no GED; Correções de upload
            (usuario_upload_id) e rotina 24/7.
          </div>
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
          placeholder="Filtrar tópicos do POP (ex.: integra contador, serpro, nfe.io, pedidos documentos, backup, sped fiscal, autonomia, upload ged, cnd)..."
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
            7. Conector RFB & CND
          </TabsTrigger>
          <TabsTrigger value="abertura" className="text-xs font-medium">
            8. Abertura
          </TabsTrigger>
          <TabsTrigger value="migracoes" className="text-xs font-medium">
            9. Migrações
          </TabsTrigger>
          <TabsTrigger value="tripe" className="text-xs font-medium">
            10. Painel Tripé
          </TabsTrigger>
          <TabsTrigger value="defis_xml" className="text-xs font-medium">
            11. DEFIS & XML
          </TabsTrigger>
          <TabsTrigger value="lote_patrimonio" className="text-xs font-medium">
            12. Lote & Motor
          </TabsTrigger>
          <TabsTrigger
            value="integra_contador"
            className="text-xs font-medium bg-teal-50 text-teal-900 border border-teal-200 font-semibold"
          >
            13. Integra Contador (SERPRO)
          </TabsTrigger>
          <TabsTrigger
            value="nfeio"
            className="text-xs font-medium bg-teal-50 text-teal-900 border border-teal-200 font-semibold"
          >
            14. NFS-e NFE.io
          </TabsTrigger>
          <TabsTrigger
            value="pedidos_docs"
            className="text-xs font-medium bg-teal-50 text-teal-900 border border-teal-200 font-semibold"
          >
            15. Pedidos de Documentos
          </TabsTrigger>
          <TabsTrigger
            value="backup"
            className="text-xs font-medium bg-teal-50 text-teal-900 border border-teal-200 font-semibold"
          >
            16. Backup Independente
          </TabsTrigger>
          <TabsTrigger
            value="sped_fiscal"
            className="text-xs font-medium bg-teal-50 text-teal-900 border border-teal-200 font-semibold"
          >
            17. SPED EFD & Hash MD5
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
                  Perfil Operacional ELLIZA (Agente IA)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-2">
                <p>
                  A ELLIZA possui identidade própria na coleção{' '}
                  <code className="bg-slate-100 px-1 py-0.5 rounded">elliza_perfil</code> (não é
                  tratada como usuário humano).
                </p>
                <p>
                  Visível com destaque no card fixo no topo de{' '}
                  <Link to="/usuarios" className="font-semibold text-[#0FA3A3] underline">
                    /usuarios
                  </Link>
                  , com diretivas e níveis de autonomia governados em{' '}
                  <Link to="/elliza" className="font-semibold text-[#0FA3A3] underline">
                    /elliza
                  </Link>
                  . Antigas contas de usuário foram neutralizadas.
                </p>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Modo de Operação:</span>
                  <Badge variant="secondary" className="bg-teal-50 text-[#0FA3A3] font-bold">
                    Supervisionado / Autonomia Real
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900">
                  <Lock className="h-4 w-4 text-emerald-600" />
                  Isolamento Multi-Tenant & LGPD
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 space-y-2">
                <p>
                  Cada escritório contábil opera sob particionamento rígido via chave primária{' '}
                  <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">tenant_id</code>.
                </p>
                <p>
                  Nenhuma automação ou prompt de IA cruza fronteiras de escritórios, clientes ou
                  bancos de dados. Backups e downloads exigem termo de ciência e logs de auditoria.
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

          {/* MATRIZ DE DEPENDÊNCIA DE CREDENCIAIS */}
          <Card className="border-teal-200 bg-teal-50/30 shadow-xs">
            <CardHeader className="pb-3 border-b border-teal-100">
              <div className="flex items-center gap-2 text-teal-900">
                <KeyRound className="h-5 w-5 text-[#0FA3A3]" />
                <CardTitle className="text-base font-bold">
                  Matriz de Dependência de Credenciais (O Que Destrava o Quê)
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-teal-800">
                A plataforma opera sob o princípio da honestidade operacional: a autonomia só é
                ativada mediante credenciais válidas e testadas.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-teal-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Evolution API (URL + API Key)</span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                      WhatsApp Real
                    </Badge>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Destrava o envio real de cobranças PIX, alertas 24/7 e pedidos de documentos
                    pelo WhatsApp. Sem credenciais, as mensagens ficam retidas em status{' '}
                    <code className="bg-slate-100 px-1 rounded">aguardando_credenciais</code> para
                    despacho posterior sob demanda.
                  </p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-teal-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">NFE.io (API Key + Company ID)</span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                      NFS-e Real
                    </Badge>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Destrava a emissão e cancelamento oficial de NFS-e junto a prefeituras
                    integradas sem depender da extensão de navegador. O XML é gravado
                    automaticamente no GED da empresa.
                  </p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-teal-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      e-CNPJ A1 + SERPRO + Túnel mTLS
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                      Integra Contador / e-CAC
                    </Badge>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Destrava consultas oficiais da Receita Federal: SITFIS, Caixa Postal DTE,
                    DCTFWeb e emissão de DAS PGDAS-D. Sem o proxy mTLS configurado, o sistema opera
                    em Modo Supervisão honesto com aviso explícito.
                  </p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-teal-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Autorização e-CAC por Empresa</span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                      Acesso aos Dados da Empresa
                    </Badge>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Cada cliente deve autorizar o e-CNPJ do escritório na Loja SERPRO / e-CAC no
                    prazo de 30 dias. A sincronização em lote só processa empresas com status{' '}
                    <code className="bg-slate-100 px-1 rounded">ativa</code>.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

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
                    A Elliza gera o XML de fechamento do e-Social, a escrituração do SPED com hash
                    MD5, a DEFIS, os lotes contábeis e a minuta da NFS-e. Contudo, o botão de
                    transmissão externa exige clique explícito de um usuário com perfil Contador ou
                    Administrador.
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
                    Caso dados cadastrais, alíquotas ou credenciais estejam ausentes, a Elliza deve
                    registrar status{' '}
                    <Badge variant="outline" className="text-amber-700">
                      pendente_credenciais
                    </Badge>{' '}
                    ou{' '}
                    <Badge variant="outline" className="text-blue-700">
                      modo_supervisao
                    </Badge>
                    . Certidões sem webservice oficial entram com número{' '}
                    <code className="bg-slate-100 px-1 rounded">DEMO-PENDENTE-WEBSERVICE</code> e
                    comunicações geradas em teste recebem o prefixo{' '}
                    <code className="bg-slate-100 px-1 rounded">[DEMONSTRAÇÃO]</code>.
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
                    <code className="bg-slate-100 px-1 py-0.5 rounded">/empresas/:id</code>. Backups
                    independentes ofuscam senhas e chaves privadas antes do download.
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
                    privativamente ao cliente. Links públicos de pedidos e abertura não exigem
                    login, mas possuem tokens criptográficos temporários vinculados exclusivamente
                    àquela empresa.
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
                    Procedimento 01: Onboarding de Empresas, Gestão de A1 & Upload GED
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Cadastro de novos clientes, migração em lote de carteiras, captura CNPJ, guarda
                    segura de credenciais e arquivamento manual no GED por drag & drop.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">Tela: /empresas e /empresas/:id</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Habilitar a empresa na plataforma com dados societários validados, regime
                  tributário correto, cofre de certificados A1 pronto para integração
                  Gov.br/e-CAC/e-Social e repositório de documentos indexado no GED.
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
                    <b>Upload de Documentos da Empresa no GED:</b> Na página de detalhes da empresa
                    (<code className="bg-slate-100 px-1 py-0.5 rounded">/empresas/:id</code>),
                    utilize o botão <b>"+ Enviar Documento"</b>. O modal oferece:
                    <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-600">
                      <li>
                        Área de arrastar-e-soltar (drag & drop) e seleção de múltiplos arquivos até
                        25MB cada;
                      </li>
                      <li>
                        Classificação em tipos pré-vinculados (Contrato Social, Procuração, Extrato
                        Bancário, Fatura de Cartão, Maquininha, etc.);
                      </li>
                      <li>
                        Injeção obrigatória do{' '}
                        <code className="bg-slate-100 px-1 rounded">usuario_upload_id</code> para
                        auditoria e prevenção do erro HTTP 400.
                      </li>
                    </ul>
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
                    clique, férias, 13º, TRCT e EFD-Reinf/DCTFWeb com badges dinâmicos de autonomia.
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

              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                <div className="flex items-center gap-2 font-semibold text-teal-900 mb-1">
                  <UserCheck className="h-4 w-4 text-[#0FA3A3]" />
                  Ponto de Aprovação Humana & Badges Dinâmicos:
                </div>
                <p className="text-slate-600">
                  As telas de e-Social e DCTFWeb exibem o badge dinâmico:
                  <b> "Automático (credenciado)"</b> quando o e-CNPJ A1 da empresa está válido e
                  ativo no cofre; ou
                  <b> "Modo Supervisão (aguardando credenciais)"</b> quando o certificado está
                  ausente ou próximo de vencer, exigindo protocolo assistido.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 3: ROTINA FISCAL & SPED (GERAL)
           ========================================================================= */}
        <TabsContent value="fiscal" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 03: Rotina Fiscal, Guias DAS/DARF & Parcelamentos
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Apurações fiscais (DAS, PIS/COFINS, IRPJ/CSLL), geração de guias de recolhimento
                    e controle de acordos PAR/PER-DCOMP.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">Tela: /fiscal e Guias da Empresa</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Apurar o faturamento mensal, calcular o imposto devido conforme o regime
                  tributário da empresa, emitir o documento de arrecadação e alimentar a conciliação
                  contábil.
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Auxiliar confere prévias e anexa guias; Contador Responsável aprova e homologa
                  apurações.
                </div>
              </div>

              <p className="text-slate-600 leading-relaxed">
                Para a escrituração estruturada de arquivos digitais, consulte o novo{' '}
                <b>POP 17 (SPED Fiscal & Contribuições)</b> com gerador de blocos 0/C/D/E/H/1 e hash
                MD5.
              </p>
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
                  Auxiliar concilia extratos e aceita pré-lançamentos; Fechamento e reabertura são
                  exclusivos do Contador.
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <div className="flex items-center gap-2 font-semibold text-amber-900 mb-1">
                  <Lock className="h-4 w-4 text-amber-600" />
                  Trava Retroativa no Backend:
                </div>
                <p className="text-slate-600">
                  Uma vez fechada a competência em{' '}
                  <code className="bg-slate-100 px-1 py-0.5 rounded">/fecho-mensal</code>, o hook de
                  banco rejeita edições ou exclusões sem autorização formal com registro na Trilha
                  de Auditoria.
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
                    escalonamento para humano e emissão assistiva.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">Tela: /nfse-whatsapp e /elliza</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <p className="text-slate-600 leading-relaxed">
                Toda emissão de NFS-e segue o padrão assistivo obrigatório: o cliente pode solicitar
                via WhatsApp, a ELLIZA gera a minuta para conferência de alíquotas e códigos de
                serviço, e o Contador aprova a transmissão. Para emissão direta via API sem depender
                de robô de tela, utilize o <b>POP 14 (Provedor NFE.io)</b>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 6: OBRIGAÇÕES & JOB 08H
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
                    Varredura agendada (cron daily_obrigacoes_reminder) com proteção anti-flood de
                    20 horas.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">Tela: /obrigacoes</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <p className="text-slate-600 leading-relaxed">
                Varredura diária pontual às 08:00 UTC fiscalizando vencimentos de obrigações em até
                7 dias, validades de certificados A1 e parcelas de acordos fiscais. Complementada
                pelo <b>Job Diário das 04:30</b> do Integra Contador SERPRO (POP 13).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 7: MONITORAMENTO CND & CONECTOR RFB HONESTO (ATUALIZADA)
           ========================================================================= */}
        <TabsContent value="monitoramento_cnd" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 07: Conector RFB Honesto, Radar CND & Reforma Tributária
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Política de transparência técnica: certidões em demonstração como "Pendente de
                    Emissão Oficial", prefixo [DEMONSTRAÇÃO] e simulador da Reforma (EC 132 / LC
                    214).
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">
                  Tela: /obrigacoes, /simulador-reforma e Dashboard
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Manter o painel de regularidade fiscal 100% aderente à realidade jurídica,
                  evitando que consultas em modo demonstração declarem falso sucesso ou CNDs
                  emitidas ficticiamente.
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Regra de Integridade:
                  </span>
                  Apenas consultas chanceladas pelo Integra Contador SERPRO com certificado cliente
                  oficial mudam o status da certidão para "Válida".
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Comportamento do Conector RFB nos Diferentes Modos:
                </h3>
                <div className="space-y-2">
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-950">
                    <span className="font-bold block">
                      1. Modo Demonstração (Sem Webservice Oficial / Sem Certificado A1):
                    </span>
                    <ul className="list-disc pl-5 mt-1 space-y-1 text-[11px] text-amber-900">
                      <li>
                        Certidões automáticas são gravadas com status{' '}
                        <code className="bg-amber-100 px-1 rounded font-bold">
                          pendente_emissao
                        </code>{' '}
                        e número de controle{' '}
                        <code className="bg-amber-100 px-1 rounded font-bold">
                          DEMO-PENDENTE-WEBSERVICE
                        </code>
                        ;
                      </li>
                      <li>
                        O widget do Dashboard <b>NÃO conta essas certidões como "100% Regular"</b>,
                        exibindo badge amarelo de alerta com aviso explícito de pendência de emissão
                        oficial;
                      </li>
                      <li>
                        Comunicações da Caixa Postal DTE geradas em regime de demonstração levam
                        obrigatoriamente o prefixo <b>"[DEMONSTRAÇÃO]"</b> no assunto;
                      </li>
                      <li>
                        Os registros de log no banco recebem{' '}
                        <code className="bg-amber-100 px-1 rounded">
                          modo_operacao: 'demonstracao'
                        </code>
                        .
                      </li>
                    </ul>
                  </div>

                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-emerald-950">
                    <span className="font-bold block">
                      2. Modo Oficial (SERPRO Integra Contador + Proxy mTLS):
                    </span>
                    <p className="mt-1 text-[11px] text-emerald-900">
                      Quando o escritório credencia as chaves na Loja SERPRO e conecta o túnel mTLS
                      (ver POP 13), o status muda para{' '}
                      <code className="bg-emerald-100 px-1 rounded font-bold">
                        oficial_integra_contador
                      </code>
                      , obtendo o número de controle oficial emitido pela Receita Federal e PGFN.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 8: ABERTURA DE EMPRESA
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
                    Workflows simultâneos de legalização, link público autoatendimento de 3 passos e
                    Kanban regulatório.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">Tela: /empresas (aba Abertura)</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <p className="text-slate-600">
                Geração de token público seguro para o cliente preencher dados básicos, sócios (QSA)
                e viabilidade sem necessidade de login. Acompanhamento interno via colunas Kanban
                até o protocolo final na Junta Comercial.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 9: MIGRAÇÕES & ONBOARDING
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
                    Rastreamento de transição de responsabilidade técnica: acolhimento, auditoria de
                    saldos e desvinculação formal.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">Tela: /empresas (aba Migrações)</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <p className="text-slate-600">
                Checklists padronizados de entrada (coleta de livros, procurações e corte de saldos)
                e saída (entrega de arquivos SPED/DRE, revogação de acessos e termo CRC).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 10: PAINEL DO TRIPÉ
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
                    Diagnóstico dos 4 elos: DP → Fiscal → Partidas Dobradas → Obrigações, com alerta
                    de elo quebrado e geração de lotes contábeis.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">Tela: /integracao</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <p className="text-slate-600">
                Auditoria de coerência entre folha fechada, impostos apurados e lançamentos
                contábeis (LOTE-FOLHA, LOTE-FISC e LOTE-LIQ).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 11: DEFIS & XML LOTE
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
                    Declaração Anual do Simples em 4 abas, exportação TXT oficial e processamento em
                    lote com isolamento de falha.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">Tela: /fiscal/defis e /fiscal</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <p className="text-slate-600">
                Montagem da DEFIS cruzando balanço, DRE e folha; importação em lote de notas fiscais
                com proteção anti-duplicidade e cascata contábil opcional.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 12: LOTE, PATRIMÔNIO & MOTOR NORMATIVO
           ========================================================================= */}
        <TabsContent value="lote_patrimonio" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 12: Rotinas em Lote, Patrimônio & Motor de Cálculo Normativo
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Execução em massa multi-empresas (/lote), localização física de bens
                    (/patrimonio) e tabelas legais unificadas (/parametros-normativos).
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">
                  Telas: /lote, /patrimonio e /parametros-normativos
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <p className="text-slate-600">
                Execução de fechamentos em massa com isolamento de falha por empresa; controle
                físico de bens imobilizados e fonte única da verdade para tabelas de INSS, IRRF e
                Simples Nacional.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 13: INTEGRA CONTADOR (SERPRO / E-CAC) - NOVO POP 13
           ========================================================================= */}
        <TabsContent value="integra_contador" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Radio className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 13: Integra Contador (SERPRO / e-CAC Oficial) & Túnel mTLS
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Credenciamento na Loja SERPRO, ambiente trial/produção, túnel mTLS na VPS,
                    autorização e-CAC por empresa, job diário 04:30 e bilhetagem.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">
                  Tela: /integracoes (Aba Integra Contador)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Estabelecer a conexão oficial de máquina-a-máquina com a Receita Federal do Brasil
                  (e-CAC) via API oficial do SERPRO, sincronizando Situação Fiscal (SITFIS), Caixa
                  Postal DTE, débitos DCTFWeb e emissão de guias DAS.
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Configuração de chaves e proxy: restrita a <b>Administrador</b>; Sincronização e
                  emissão assistida: <b>Contador</b>.
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Passo a Passo de Implantação e Operação:
                </h3>
                <ol className="list-decimal pl-4 space-y-2">
                  <li>
                    <b>Credenciamento na Loja SERPRO:</b> Acesse o portal da Loja SERPRO com o
                    e-CNPJ da Rumo Consultoria Contábil. Contrate o serviço <i>Integra Contador</i>{' '}
                    e obtenha as credenciais OAuth2:{' '}
                    <code className="bg-slate-100 px-1 rounded">Consumer Key</code> e{' '}
                    <code className="bg-slate-100 px-1 rounded">Consumer Secret</code>.
                  </li>
                  <li>
                    <b>Configuração do Ambiente:</b> Na tela{' '}
                    <code className="bg-slate-100 px-1 rounded">/integracoes</code>, selecione entre{' '}
                    <b>Trial (Homologação)</b> para testes sem custo de bilhetagem ou{' '}
                    <b>Produção Oficial</b> para consultas com valor jurídico.
                  </li>
                  <li>
                    <b>Túnel mTLS na VPS (Handshake de Certificado Cliente):</b>
                    <p className="mt-1 text-slate-600">
                      O gateway do SERPRO exige autenticação mTLS (mutual TLS) para injeção do
                      certificado e-CNPJ nas consultas e-CAC. Utilize o pacote{' '}
                      <code className="bg-slate-100 px-1 rounded">serpro-mtls-proxy/</code>{' '}
                      disponibilizado no projeto, execute via Docker na porta 3001 da VPS e informe
                      o endereço HTTPS no campo{' '}
                      <code className="bg-slate-100 px-1 rounded">proxy_mtls_url</code>.
                    </p>
                  </li>
                  <li>
                    <b>Botão "Testar Conexão" (Diagnóstico Honesto):</b> O teste valida a
                    autenticação OAuth2 junto ao SERPRO e a alcançabilidade do proxy mTLS. Sem o
                    proxy mTLS configurado, o diagnóstico avisa com clareza que o conector operará
                    em <b>Modo Supervisão honesto</b>, sem declarar falso credenciamento.
                  </li>
                  <li>
                    <b>Autorização de Acesso e-CAC por Empresa Cliente (Regra dos 30 Dias):</b>
                    <p className="mt-1 text-slate-600">
                      Na tabela de empresas do painel Integra Contador, acompanhe o status de
                      autorização:
                      <span className="inline-flex gap-1 ml-1 flex-wrap">
                        <Badge variant="outline" className="text-emerald-700 bg-emerald-50">
                          ativa
                        </Badge>
                        <Badge variant="outline" className="text-amber-700 bg-amber-50">
                          em_analise
                        </Badge>
                        <Badge variant="outline" className="text-rose-700 bg-rose-50">
                          vencida
                        </Badge>
                        <Badge variant="outline" className="text-slate-600 bg-slate-50">
                          nao_solicitada
                        </Badge>
                      </span>
                      . O contribuinte cliente deve acessar o e-CAC e conceder autorização para o
                      CNPJ do escritório em até <b>30 dias</b>. Após esse prazo, a solicitação
                      expira e exige reenvio.
                    </p>
                  </li>
                  <li>
                    <b>
                      Job Diário das 04:30 (
                      <code className="bg-slate-100 px-1 rounded">
                        integra_contador_sync_diario
                      </code>
                      ):
                    </b>
                    <p className="mt-1 text-slate-600">
                      Executado automaticamente todas as madrugadas às 04:30. Varre exclusivamente
                      as empresas com autorização{' '}
                      <code className="bg-slate-100 px-1 rounded">ativa</code>, atualizando
                      certidões CND, comunicações DTE e extratos DCTFWeb.
                    </p>
                  </li>
                  <li>
                    <b>Sincronizar Agora & Emissão de DAS via ELLIZA:</b>
                    <p className="mt-1 text-slate-600">
                      O contador pode disparar a sincronização em lote sob demanda clicando em{' '}
                      <i>"Sincronizar agora"</i>. A emissão de guias DAS passa obrigatoriamente pela
                      fila de aprovação da ELLIZA (
                      <code className="bg-slate-100 px-1 rounded">elliza_aprovacoes</code>) antes da
                      gravação em <code className="bg-slate-100 px-1 rounded">guia_pagamentos</code>
                      .
                    </p>
                  </li>
                  <li>
                    <b>Painel de Consumo & Bilhetagem Mensal:</b>
                    <p className="mt-1 text-slate-600">
                      Toda chamada ao SERPRO é registrada na coleção{' '}
                      <code className="bg-slate-100 px-1 rounded">integra_contador_consumo</code>,
                      discriminando quantidade, custo estimado em reais e divisão por serviço
                      (SITFIS, CAIXAPOSTAL, DCTFWEB, PGDASD).
                    </p>
                  </li>
                </ol>
              </div>

              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                <div className="flex items-center gap-2 font-semibold text-teal-900 mb-1">
                  <UserCheck className="h-4 w-4 text-[#0FA3A3]" />
                  Ponto de Aprovação Humana Obrigatório:
                </div>
                <p className="text-slate-600">
                  Guias de DAS apuradas e comunicados recebidos no DTE entram em fila de
                  conferência. Nenhuma notificação de débito é disparada ao cliente sem prévia
                  revisão do Contador.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 14: PROVEDOR NFS-E NFE.IO - NOVO POP 14
           ========================================================================= */}
        <TabsContent value="nfeio" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck2 className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 14: Provedor NFS-e NFE.io & Webhook de Conciliação
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Emissão de notas de serviço via API NFE.io ao lado de Gov.br/Betha/Ginfes,
                    webhook em tempo real e arquivamento automático do XML no GED.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">
                  Tela: /integracoes (Aba NFS-e & WhatsApp)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Emitir e cancelar NFS-e de forma programática sem depender de robôs de tela de
                  prefeituras, recebendo eventos de sucesso/erro via webhook oficial e registrando
                  os arquivos fiscais diretamente no GED.
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Configuração de API Key: <b>Administrador</b>; Emissão e cancelamento de notas:{' '}
                  <b>Contador</b>.
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Operação do Provedor NFE.io:
                </h3>
                <ol className="list-decimal pl-4 space-y-2">
                  <li>
                    <b>Configuração das Credenciais:</b> Selecione o provedor fiscal{' '}
                    <code className="bg-slate-100 px-1 rounded font-bold">nfeio</code> em{' '}
                    <code className="bg-slate-100 px-1 rounded">/integracoes</code>. Preencha a{' '}
                    <b>Chave de API (nfeio_api_key)</b> e o <b>Company ID (nfeio_company_id)</b>. A
                    configuração pode ser global (pelo escritório) ou personalizada por empresa.
                  </li>
                  <li>
                    <b>Testar Conexão:</b> O sistema valida a chave consumindo a API da NFE.io e
                    exibe o status de credenciamento ativo.
                  </li>
                  <li>
                    <b>Ciclo de Emissão Assistiva:</b> O contador revisa a minuta em{' '}
                    <code className="bg-slate-100 px-1 rounded">/nfse-whatsapp</code> e aciona{' '}
                    <i>"Aprovar e Emitir"</i>. A requisição é despachada via{' '}
                    <code className="bg-slate-100 px-1 rounded">NfeIoFiscalAdapter</code> em modo{' '}
                    <code className="bg-slate-100 px-1 rounded">nfeio_real</code>.
                  </li>
                  <li>
                    <b>Webhook de Eventos & Baixa no GED:</b>
                    <p className="mt-1 text-slate-600">
                      O webhook escuta eventos assíncronos da NFE.io:
                      <ul className="list-disc pl-5 mt-1 space-y-0.5">
                        <li>
                          <b>Nota Autorizada:</b> Obtém o XML oficial e o PDF do DANFSE e anexa
                          automaticamente no GED da empresa com tipo{' '}
                          <code className="bg-slate-100 px-1 rounded">nota_fiscal</code>;
                        </li>
                        <li>
                          <b>Cancelamento:</b> Atualiza o status da nota para{' '}
                          <code className="bg-slate-100 px-1 rounded">cancelada</code> com o
                          protocolo de cancelamento;
                        </li>
                        <li>
                          <b>Erro na Emissão:</b> Registra o motivo retornado pela prefeitura na
                          Trilha de Auditoria e notifica a equipe contábil.
                        </li>
                      </ul>
                    </p>
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 15: PEDIDOS DE DOCUMENTOS - NOVO POP 15
           ========================================================================= */}
        <TabsContent value="pedidos_docs" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileUp className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 15: Pedidos de Documentos & Link Público Autoatendimento
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Solicitações mensais aos clientes (extratos, cartões, maquininhas e contratos),
                    envio por WhatsApp ativo, link público sem login e baixa automática no GED.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">
                  Tela: /portal-acessos (Aba Pedidos de Documentos)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Eliminar a troca desorganizada de comprovantes por e-mail e mensageiros. Coletar a
                  documentação suporte do Fecho Contábil por um link amigável de autoatendimento
                  indexado por competência.
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Auxiliar cria pedidos e dispara lembretes; upload pelo cliente é aberto via token
                  temporário seguro.
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Os 4 Tipos Fixos de Solicitação:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-semibold text-slate-900 block">
                      1. Extratos Bancários (PDF / OFX):
                    </span>
                    Contas correntes e aplicações da empresa para conciliação contábil do mês.
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-semibold text-slate-900 block">
                      2. Faturas de Cartão de Crédito:
                    </span>
                    Faturas completas dos cartões corporativos com detalhamento das despesas.
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-semibold text-slate-900 block">
                      3. Relatórios de Maquininhas & Apps:
                    </span>
                    Extratos de liquidação de vendas (Cielo, Stone, Rede, PagSeguro e Mercado Pago).
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-semibold text-slate-900 block">
                      4. Contratos de Crédito / Empréstimos:
                    </span>
                    Cédulas de crédito bancário, leasing e contratos de financiamento contraídos no
                    período.
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Fluxo Operacional de Envio e Baixa:
                </h3>
                <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                  <li>
                    <b>Criação do Pedido:</b> Em{' '}
                    <code className="bg-slate-100 px-1 rounded">/portal-acessos</code> →{' '}
                    <i>Pedidos de Documentos</i>, selecione a empresa, a competência e os tipos
                    desejados com o prazo de validade do link (padrão: 15 dias).
                  </li>
                  <li>
                    <b>Link Público para o Cliente:</b> O sistema gera rota pública única (
                    <code className="bg-slate-100 px-1 rounded">/pedidos-documentos/:token</code>).
                    O cliente anexa os arquivos do celular ou computador sem login ou senha.
                  </li>
                  <li>
                    <b>Envio por WhatsApp via Evolution API:</b> Respeita a autorização ativa da
                    empresa em{' '}
                    <code className="bg-slate-100 px-1 rounded">
                      whatsapp_notificacoes_autorizadas
                    </code>
                    , com proteção anti-flood de 24 horas.
                  </li>
                  <li>
                    <b>Baixa Automática no GED:</b> Ao receber o upload, o arquivo é gravado no GED
                    da empresa com a categoria correta (
                    <code className="bg-slate-100 px-1 rounded">extrato_bancario</code>,{' '}
                    <code className="bg-slate-100 px-1 rounded">fatura_cartao</code>, etc.) e o
                    contador responsável recebe notificação in-app.
                  </li>
                  <li>
                    <b>Gestão de Status:</b> O pedido progride visualmente de{' '}
                    <Badge variant="outline">pendente</Badge> para{' '}
                    <Badge variant="outline">parcialmente_atendido</Badge> e{' '}
                    <Badge variant="outline">atendido</Badge> (ou recebido com atraso se
                    ultrapassado o prazo).
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 16: BACKUP INDEPENDENTE - NOVO POP 16
           ========================================================================= */}
        <TabsContent value="backup" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 16: Backup Independente, GED em Lote & Retenção
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Segurança de dados do escritório: job diário das 03:30 (30 coleções), exportação
                    zipada do GED com manifesto, retenção de 7 snapshots e governança LGPD.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">
                  Tela: /backup (Restrita a Administrador)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Garantir soberania e custódia definitiva dos dados fiscais, societários, contábeis
                  e de pessoal do escritório contábil e de seus clientes, permitindo restauração
                  independente de plataforma.
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Acesso à tela e downloads: <b>estritamente exclusivo de Administrador</b> com
                  dupla confirmação e registro em trilha de auditoria.
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Pilares do Módulo de Backup Independente:
                </h3>
                <div className="space-y-2">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900 block">
                      1. Job Agendado Diário das 03:30 (
                      <code className="bg-white px-1 rounded">
                        daily_backup_snapshot_independente
                      </code>
                      ):
                    </span>
                    Exporta todas as 30 coleções de negócio do banco de dados em formato JSON
                    compactado. Campos de senhas de certificados, chaves privadas e tokens de
                    integração são automaticamente ofuscados antes da gravação do snapshot.
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900 block">
                      2. Geração sob Demanda ("Gerar Backup Agora"):
                    </span>
                    O administrador pode solicitar um snapshot imediato antes de grandes fechamentos
                    ou importações em lote. O processamento gera registro na coleção{' '}
                    <code className="bg-white px-1 rounded">backups_execucoes</code>.
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900 block">
                      3. Download Seguro & Modal de Ciência LGPD:
                    </span>
                    Todo download exige clique em modal de advertência formal de responsabilidade
                    civil e técnica pela guarda dos dados pessoais e financeiros de terceiros
                    (LGPD).
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900 block">
                      4. Exportação Zipada do GED em Lote:
                    </span>
                    Gera arquivo ZIP unificado estruturado em pastas por{' '}
                    <code className="bg-white px-1 rounded">
                      CNPJ_Empresa/Categoria_Documento/Nome_Arquivo
                    </code>{' '}
                    acompanhado de um arquivo{' '}
                    <code className="bg-white px-1 rounded">manifesto.json</code> contendo
                    metadados, datas de emissão e hashes dos arquivos originais.
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900 block">
                      5. Política de Retenção (7 Snapshots Mais Recentes):
                    </span>
                    O sistema mantém os últimos 7 snapshots do tenant no storage e purga
                    automaticamente execuções anteriores, gravando evento de purga na Trilha de
                    Auditoria.
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900 block">
                      6. Camada de Código-Fonte (GitHub Conectado):
                    </span>
                    A plataforma conta com repositório GitHub conectado no painel do projeto para
                    versionamento de código, garantindo que snapshots de dados e versões da
                    aplicação estejam sempre sincronizados.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            ABA 17: SPED FISCAL & CONTRIBUIÇÕES - NOVO POP 17
           ========================================================================= */}
        <TabsContent value="sped_fiscal" className="space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileCode2 className="h-5 w-5 text-[#0FA3A3]" />
                    Procedimento 17: Escrituração SPED Fiscal & Contribuições (Blocos & PVA)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Gerador próprio EFD-ICMS/IPI (blocos 0, C, D, E, H, 1) e EFD-Contribuições (0,
                    A, C, D, F, M), bloco 9 com hash MD5 e validação no PVA da Receita Federal.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">
                  Tela: /fiscal (Aba Escrituração SPED)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">🎯 Objetivo:</span>
                  Compilar os registros fiscais de entradas, saídas e serviços tomados/prestados na
                  estrutura exata do Guia Prático da EFD, gerando arquivo TXT imutável para
                  submissão no Programa Validador e Assinador (PVA).
                </div>
                <div>
                  <span className="font-semibold text-slate-900 block mb-1">
                    🔑 Permissão Mínima:
                  </span>
                  Geração de prévia: <b>Auxiliar</b>; Assinatura com certificado e registro de
                  protocolo: <b>Contador</b>.
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Estrutura de Blocos do Gerador Próprio:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-600">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <span className="font-bold text-slate-900 block text-xs">
                      EFD-ICMS/IPI (SPED Fiscal)
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      <li>
                        <b>Bloco 0:</b> Abertura, dados cadastrais, endereço e contabilista
                        responsável;
                      </li>
                      <li>
                        <b>Bloco C:</b> Documentos fiscais de mercadorias (C100 com NF-e e C190
                        analítico);
                      </li>
                      <li>
                        <b>Bloco D:</b> Transportes e fretes (D001 com abertura/encerramento);
                      </li>
                      <li>
                        <b>Bloco E:</b> Apuração de ICMS próprio e IPI (E100 e E110);
                      </li>
                      <li>
                        <b>Bloco H:</b> Inventário físico de estoques;
                      </li>
                      <li>
                        <b>Bloco 1:</b> Outras informações e complementos fiscais;
                      </li>
                      <li>
                        <b>Bloco 9:</b> Totalizadores e encerramento do arquivo.
                      </li>
                    </ul>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <span className="font-bold text-slate-900 block text-xs">
                      EFD-Contribuições (PIS/COFINS & CBS)
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      <li>
                        <b>Bloco 0:</b> Abertura, identificação e regime de incidência tributária;
                      </li>
                      <li>
                        <b>Bloco A:</b> Documentos de serviços prestados (A100 e A170 da NFS-e);
                      </li>
                      <li>
                        <b>Bloco C:</b> Documentos fiscais de mercadorias com incidência de
                        PIS/COFINS;
                      </li>
                      <li>
                        <b>Bloco D & F:</b> Transportes e demais documentos/créditos de insumos;
                      </li>
                      <li>
                        <b>Bloco M:</b> Apuração das contribuições (M200 para PIS e M600 para
                        COFINS);
                      </li>
                      <li>
                        <b>Bloco 1 & 9:</b> Outras informações, contadores de registros e
                        encerramento.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Regras Cruciais de Validação e Transmissão:
                </h3>
                <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                  <li>
                    <b>Validação Prévia de Estrutura:</b> Antes de gerar o arquivo, o sistema audita
                    CNPJ, UF, Inscrição Estadual e existência de movimentações no período.
                  </li>
                  <li>
                    <b>Escrituração "Sem Movimento" Declarada:</b> Quando não houver notas fiscais
                    no período, o arquivo é gerado com os registros de abertura indicando sem
                    movimento (<code className="bg-slate-100 px-1 rounded">|C001|1|</code> ou{' '}
                    <code className="bg-slate-100 px-1 rounded">|A001|1|</code>).{' '}
                    <b>Jamais simular ou inventar dados fictícios</b>.
                  </li>
                  <li>
                    <b>Hash MD5 Imutável:</b> Ao gerar o arquivo TXT, o algoritmo calcula o hash MD5
                    (32 caracteres hexadecimais) e grava no registro do banco para garantia de
                    integridade da cadeia de custódia.
                  </li>
                  <li>
                    <b>Submissão no PVA & Registro de Recibo:</b> O operador faz o download do .txt,
                    abre o PVA da Receita Federal correspondente, assina com o e-CNPJ A1 da empresa
                    e transmite. Em seguida, anexa o número do recibo oficial na plataforma para
                    arquivamento no GED.
                  </li>
                </ol>
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
                    Procedimentos rápidos para importação S-2200, baixa assistida, monitor de CNDs e
                    governança da ELLIZA.
                  </CardDescription>
                </div>
                <Badge className="bg-slate-800 text-white">Plataforma Contábil SaaS v0.0.102</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Importação S-2200 */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Users className="h-4 w-4 text-[#0FA3A3]" />
                    <span>Importação de Colaboradores via e-Social (S-2200)</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    <b>Onde:</b> Departamento Pessoal → Colaboradores →{' '}
                    <i>"Importar via e-Social"</i>.
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    Upload de XMLs de admissão com prévia estruturada e verificação anti-duplicidade
                    estrita por CPF antes da gravação no banco de dados.
                  </p>
                </div>

                {/* 2. Painel Status de Autonomia */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Bot className="h-4 w-4 text-[#0FA3A3]" />
                    <span>Painel Status de Autonomia (/elliza)</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    <b>Onde:</b> Menu ELLIZA → <i>Status de Autonomia</i>.
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    Acompanhamento em tempo real das credenciais Evolution API e certificados A1 com
                    radar de vencimentos (&lt;30 e &lt;15 dias) e botão para{' '}
                    <i>"Despachar Fila Agora"</i> das mensagens retidas.
                  </p>
                </div>

                {/* 3. Monitor de CNDs no Dashboard */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <ShieldCheck className="h-4 w-4 text-[#0FA3A3]" />
                    <span>Monitor de CNDs no Dashboard Geral</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    <b>Onde:</b> Tela inicial{' '}
                    <code className="bg-white px-1 rounded">/dashboard</code>.
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    Régua de saúde das certidões essenciais (Federal/PGFN, CNDT, CRF/FGTS, Estadual
                    e Municipal). Certidões sem webservice oficial entram em amarelo como "Pendente
                    de Emissão Oficial" sem declarar falso sucesso.
                  </p>
                </div>

                {/* 4. Manual de Ativação Complementar */}
                <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-teal-950">
                    <BookOpen className="h-4 w-4 text-[#0FA3A3]" />
                    <span>Manual de Ativação Complementar (/manual)</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Guias visuais complementares para parametrização inicial, webhook da Evolution
                    API, pacote serpro-mtls-proxy e credenciamento na Loja SERPRO.
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
            ABA FICHA DE HABILITAÇÃO OPERACIONAL (ATUALIZADA)
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
                    Documento comprobatório de capacitação técnica da equipe e certificação do motor
                    de automação (Synapse Robotics) — Versão 0.0.102.
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
                    Checklist de Habilitação por Módulo (17 Procedimentos + Governança &
                    Complementos):
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
                  Declaro que a operação do motor <b>Elliza Contábil (Synapse Robotics)</b> foi
                  devidamente instruída conforme os Procedimentos Operacionais Padrão (POP)
                  descritos neste manual, compreendendo os 17 procedimentos operacionais e suas
                  diretivas de governança. Fica expressamente reconhecido que a tecnologia atua em
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

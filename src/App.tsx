import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { OnlineProvider } from '@/contexts/OnlineContext'
import { Toaster } from '@/components/ui/toaster'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'

// Pages
import Login from '@/pages/Login'
import SignUp from '@/pages/SignUp'
import Dashboard from '@/pages/Dashboard'
import ElisaFilaPage from '@/pages/ElisaFilaPage'
import ProcessosSopsPage from '@/pages/ProcessosSopsPage'
import ProcessoDetailExecucaoPage from '@/pages/ProcessoDetailExecucaoPage'
import Empresas from '@/pages/Empresas'
import EmpresaForm from '@/pages/EmpresaForm'
import EmpresaDetail from '@/pages/EmpresaDetail'
import Documentos from '@/pages/Documentos'
import WorkflowPage from '@/pages/Workflow'
import Fiscal from '@/pages/Fiscal'
import Integracoes from '@/pages/Integracoes'
import PainelIntegracao from '@/pages/PainelIntegracao'
import Usuarios from '@/pages/Usuarios'
import Auditoria from '@/pages/Auditoria'
import RumoAgentPage from '@/pages/RumoAgent'
import EllizaPage from '@/pages/EllizaPage'
import Perfil from '@/pages/Perfil'
import Obrigacoes from '@/pages/Obrigacoes'
import Relatorios from '@/pages/Relatorios'
import LancamentosContabeis from '@/pages/LancamentosContabeis'
import Balancete from '@/pages/Balancete'
import DepartamentoPessoal from '@/pages/DepartamentoPessoal'
import PortalClientePage from '@/pages/PortalCliente'
import PortalAcessosPage from '@/pages/PortalAcessos'
import MapeamentoContabilPage from '@/pages/MapeamentoContabil'
import PreLancamentoPage from '@/pages/PreLancamento'
import PatrimonioPage from '@/pages/Patrimonio'
import FechoMensalPage from '@/pages/FechoMensal'
import RelatoriosContabeisPage from '@/pages/RelatoriosContabeis'
import { ContratosPage } from '@/pages/Contratos'
import { ImpostosRetidosPage } from '@/pages/ImpostosRetidos'
import FinanceiroPage from '@/pages/Financeiro'
import FluxoCaixaPage from '@/pages/FluxoCaixa'
import VerificarAssinaturaPage from '@/pages/VerificarAssinatura'
import AberturaClientePublicoPage from '@/pages/AberturaClientePublico'
import PedidosClientePublicoPage from '@/pages/PedidosClientePublico'
import PortalEmpregadoPage from '@/pages/PortalEmpregado'
import ExtensaoWhatsAppPage from '@/pages/ExtensaoWhatsApp'
import SimuladorReformaPage from '@/pages/SimuladorReforma'
import NfseWhatsappPage from '@/pages/NfseWhatsapp'
import AnalyticsTributarioPage from '@/pages/AnalyticsTributario'
import MonitoramentoLegislativoPage from '@/pages/MonitoramentoLegislativo'
import PopTreinamentoPage from '@/pages/PopTreinamento'
import ManualPage from '@/pages/Manual'
import LotePage from '@/pages/LotePage'
import ParametrosNormativosPage from '@/pages/ParametrosNormativosPage'
import BackupPage from '@/pages/BackupPage'
import NotFound from '@/pages/NotFound'

export default function App() {
  return (
    <AuthProvider>
      <OnlineProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/verificar-assinatura" element={<VerificarAssinaturaPage />} />
          <Route path="/abertura/:token" element={<AberturaClientePublicoPage />} />
          <Route path="/pedidos-documentos/:token" element={<PedidosClientePublicoPage />} />
          <Route path="/portal-empregado" element={<PortalEmpregadoPage />} />

          {/* Protected Application Routes wrapped by Layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Nova Arquitetura Operacional Elliza */}
            <Route path="/elisa-fila" element={<ElisaFilaPage />} />
            <Route path="/processos" element={<ProcessosSopsPage />} />
            <Route path="/processos/:id" element={<ProcessoDetailExecucaoPage />} />

            {/* Empresas */}
            <Route path="/empresas" element={<Empresas />} />
            <Route path="/empresas/nova" element={<EmpresaForm />} />
            <Route path="/empresas/:id" element={<EmpresaDetail />} />
            <Route path="/empresas/:id/editar" element={<EmpresaForm />} />

            {/* Financeiro (P1/P2) */}
            <Route path="/financeiro" element={<FinanceiroPage />} />
            <Route path="/fluxo-caixa" element={<FluxoCaixaPage />} />

            {/* Core Modules */}
            <Route path="/documentos" element={<Documentos />} />
            <Route path="/workflow" element={<WorkflowPage />} />
            <Route path="/workflow/:id" element={<WorkflowPage />} />
            <Route path="/obrigacoes" element={<Obrigacoes />} />
            <Route path="/fiscal" element={<Fiscal />} />
            <Route path="/fiscal/defis" element={<Fiscal />} />
            <Route path="/analytics-tributario" element={<AnalyticsTributarioPage />} />
            <Route path="/monitoramento-legislativo" element={<MonitoramentoLegislativoPage />} />
            <Route path="/nfse-whatsapp" element={<NfseWhatsappPage />} />
            <Route path="/simulador-reforma" element={<SimuladorReformaPage />} />

            {/* Módulo Departamento Pessoal (P1) */}
            <Route path="/departamento-pessoal" element={<DepartamentoPessoal />} />
            <Route path="/impostos-retidos" element={<ImpostosRetidosPage />} />

            {/* Módulo Contábil (P1) e Fecho Automático */}
            <Route path="/contabil/lancamentos" element={<LancamentosContabeis />} />
            <Route path="/contabil/pre-lancamento" element={<PreLancamentoPage />} />
            <Route path="/contabil/balancete" element={<Balancete />} />
            <Route path="/contabil/mapeamento" element={<MapeamentoContabilPage />} />

            {/* Novos Módulos: Patrimônio, Fecho Mensal e Relatórios Contábeis */}
            <Route path="/patrimonio" element={<PatrimonioPage />} />
            <Route path="/fecho-mensal" element={<FechoMensalPage />} />
            <Route path="/relatorios-contabeis" element={<RelatoriosContabeisPage />} />
            <Route path="/contratos" element={<ContratosPage />} />

            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/integracoes" element={<Integracoes />} />
            <Route path="/integracao" element={<PainelIntegracao />} />
            <Route path="/lote" element={<LotePage />} />
            <Route path="/parametros-normativos" element={<ParametrosNormativosPage />} />
            <Route path="/extensao" element={<ExtensaoWhatsAppPage />} />
            {/* Gestão */}
            <Route path="/manual" element={<ManualPage />} />
            <Route path="/pop-treinamento" element={<PopTreinamentoPage />} />
            <Route path="/portal-acessos" element={<PortalAcessosPage />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/usuarios/perfis" element={<Usuarios />} />
            <Route path="/auditoria" element={<Auditoria />} />
            <Route path="/backup" element={<BackupPage />} />
            <Route path="/configuracoes/backup" element={<BackupPage />} />
            {/* ELLIZA — Hiperautomação 24/7 Nativa */}
            <Route path="/elliza" element={<EllizaPage />} />

            {/* Rumo Agent (Native IA) */}
            <Route path="/rumo-agent" element={<RumoAgentPage />} />

            {/* Perfil */}
            <Route path="/perfil" element={<Perfil />} />
          </Route>

          {/* Portal do Cliente (Layout Simplificado Exclusivo para Empresas) */}
          <Route
            path="/portal"
            element={
              <ProtectedRoute>
                <PortalClientePage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </OnlineProvider>
    </AuthProvider>
  )
}

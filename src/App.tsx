import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'

// Pages
import Login from '@/pages/Login'
import SignUp from '@/pages/SignUp'
import Dashboard from '@/pages/Dashboard'
import Empresas from '@/pages/Empresas'
import EmpresaForm from '@/pages/EmpresaForm'
import EmpresaDetail from '@/pages/EmpresaDetail'
import Documentos from '@/pages/Documentos'
import WorkflowPage from '@/pages/Workflow'
import Fiscal from '@/pages/Fiscal'
import Integracoes from '@/pages/Integracoes'
import Usuarios from '@/pages/Usuarios'
import Auditoria from '@/pages/Auditoria'
import RumoAgentPage from '@/pages/RumoAgent'
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
import { ImpostosRetidosPage } from '@/pages/ImpostosRetidos'
import FinanceiroPage from '@/pages/Financeiro'
import FluxoCaixaPage from '@/pages/FluxoCaixa'
import VerificarAssinaturaPage from '@/pages/VerificarAssinatura'
import NotFound from '@/pages/NotFound'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/verificar-assinatura" element={<VerificarAssinaturaPage />} />

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

          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/integracoes" element={<Integracoes />} />

          {/* Gestão */}
          <Route path="/portal-acessos" element={<PortalAcessosPage />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/usuarios/perfis" element={<Usuarios />} />
          <Route path="/auditoria" element={<Auditoria />} />

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
    </AuthProvider>
  )
}

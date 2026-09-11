import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Compass,
  LayoutDashboard,
  Building2,
  FileText,
  GitPullRequest,
  Calculator,
  Layers,
  Users,
  ShieldCheck,
  Sparkles,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Menu,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  BookOpen,
  FileSpreadsheet,
  CheckSquare,
  PieChart,
  Boxes,
  Wallet,
  TrendingUp,
  Plus,
  Receipt,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { empresasService } from '@/services/empresas'
import { documentosService } from '@/services/documentos'
import { notificacoesService } from '@/services/notificacoes'
import { obrigacoesService } from '@/services/obrigacoes'
import type { Empresa, Documento, NotificacaoRecord } from '@/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import pb from '@/lib/pocketbase/client'
import { cn } from '@/lib/utils'

export default function Layout() {
  const { user, tenant, tenants, member, signOut, switchTenant, createEscritorio } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Dialog Criar Novo Escritório
  const [modalNovoEscritorioOpen, setModalNovoEscritorioOpen] = useState(false)
  const [nomeNovoEscritorio, setNomeNovoEscritorio] = useState('')
  const [cnpjNovoEscritorio, setCnpjNovoEscritorio] = useState('')
  const [criandoEscritorio, setCriandoEscritorio] = useState(false)

  // Global search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResultsOpen, setSearchResultsOpen] = useState(false)
  const [matchingEmpresas, setMatchingEmpresas] = useState<Empresa[]>([])
  const [matchingDocumentos, setMatchingDocumentos] = useState<Documento[]>([])

  // Realtime Notifications State
  const [notificacoes, setNotificacoes] = useState<NotificacaoRecord[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false)

  // Badge count for Obrigacoes (atrasadas + vencendo em <= 7 dias)
  const [obrigacoesBadgeCount, setObrigacoesBadgeCount] = useState<number>(0)

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false)
    setSearchResultsOpen(false)
  }, [location.pathname])

  // Global search lookup
  useEffect(() => {
    if (!tenant?.id || searchQuery.trim().length < 2) {
      setMatchingEmpresas([])
      setMatchingDocumentos([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const q = searchQuery.trim()
        const [empRes, docRes] = await Promise.all([
          empresasService.list(
            tenant.id,
            `razao_social ~ "${q}" || nome_fantasia ~ "${q}" || cnpj ~ "${q}"`,
          ),
          documentosService.list(tenant.id, `nome_arquivo ~ "${q}" || observacoes ~ "${q}"`),
        ])
        setMatchingEmpresas(empRes.slice(0, 5))
        setMatchingDocumentos(docRes.slice(0, 5))
        setSearchResultsOpen(true)
      } catch (err) {
        console.error('Search error:', err)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, tenant?.id])

  // Page title mapping
  const getPageTitle = () => {
    const path = location.pathname
    if (path.startsWith('/dashboard') || path === '/') return 'Dashboard'
    if (path.startsWith('/empresas/nova')) return 'Nova Empresa'
    if (path.includes('/editar')) return 'Editar Empresa'
    if (path.startsWith('/empresas/')) return 'Detalhes da Empresa'
    if (path.startsWith('/empresas')) return 'Empresas'
    if (path.startsWith('/documentos')) return 'Documentos & GED'
    if (path.startsWith('/fluxo-caixa')) return 'Fluxo de Caixa & DFC'
    if (path.startsWith('/financeiro')) return 'Financeiro & Conciliação'
    if (path.startsWith('/workflow')) return 'Gestão de Workflows'
    if (path.startsWith('/obrigacoes')) return 'Módulo de Obrigações'
    if (path.startsWith('/fiscal')) return 'Controle Fiscal'
    if (path.startsWith('/departamento-pessoal')) return 'Departamento Pessoal (DP)'
    if (path.startsWith('/impostos-retidos')) return 'Gestão de Impostos Retidos'
    if (path.startsWith('/contabil/lancamentos')) return 'Lançamentos Contábeis'
    if (path.startsWith('/contabil/pre-lancamento')) return 'Pré-Lançamento Inteligente'
    if (path.startsWith('/contabil/balancete')) return 'Balancete de Verificação'
    if (path.startsWith('/contabil/mapeamento')) return 'Mapeamento Contábil Automático'
    if (path.startsWith('/patrimonio')) return 'Patrimônio & Gestão de Ativos'
    if (path.startsWith('/fecho-mensal')) return 'Fecho Mensal & Checklist'
    if (path.startsWith('/relatorios-contabeis')) return 'DRE & Balanço Patrimonial'
    if (path.startsWith('/portal-acessos')) return 'Gestão de Acessos ao Portal'
    if (path.startsWith('/relatorios')) return 'Relatórios Gerenciais'
    if (path.startsWith('/integracoes')) return 'Integrações'
    if (path.startsWith('/usuarios')) return 'Usuários & Perfis'
    if (path.startsWith('/auditoria')) return 'Trilha de Auditoria'
    if (path.startsWith('/rumo-agent')) return 'Rumo Agent (IA)'
    if (path.startsWith('/perfil')) return 'Minha Conta'
    return 'Rumo Contábil'
  }

  // Load and subscribe to notifications
  useEffect(() => {
    if (!tenant?.id || !user?.id) return

    const fetchNotifs = async () => {
      try {
        const list = await notificacoesService.list(tenant.id, user.id)
        setNotificacoes(list)
        const unread = list.filter((n) => !n.lida).length
        setUnreadCount(unread)
      } catch (err) {
        console.error('Erro ao carregar notificações:', err)
      }
    }

    const fetchObrigacoesAlerts = async () => {
      try {
        const obs = await obrigacoesService.list(
          tenant.id,
          "status = 'pendente' || status = 'em_andamento' || status = 'atrasada'",
        )
        const now = Date.now()
        let count = 0
        obs.forEach((ob) => {
          if (ob.status === 'atrasada') {
            count++
          } else {
            const diffDays = Math.ceil(
              (new Date(ob.vencimento).getTime() - now) / (1000 * 60 * 60 * 24),
            )
            if (diffDays <= 7) count++
          }
        })
        setObrigacoesBadgeCount(count)
      } catch {
        /* intentionally ignored */
      }
    }

    fetchNotifs()
    fetchObrigacoesAlerts()

    // Realtime subscription for notificacoes
    pb.collection('notificacoes')
      .subscribe('*', () => {
        fetchNotifs()
      })
      .catch(() => {})

    pb.collection('obrigacoes')
      .subscribe('*', () => {
        fetchObrigacoesAlerts()
      })
      .catch(() => {})

    return () => {
      pb.collection('notificacoes')
        .unsubscribe('*')
        .catch(() => {})
      pb.collection('obrigacoes')
        .unsubscribe('*')
        .catch(() => {})
    }
  }, [tenant?.id, user?.id])

  const handleMarkAsRead = async (id: string, link?: string) => {
    try {
      await notificacoesService.markAsRead(id)
      setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
      if (link) {
        setNotifDropdownOpen(false)
        navigate(link)
      }
    } catch {
      /* intentionally ignored */
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!tenant?.id || !user?.id) return
    try {
      await notificacoesService.markAllAsRead(tenant.id, user.id)
      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
      setUnreadCount(0)
    } catch {
      /* intentionally ignored */
    }
  }

  const navGroups = [
    {
      group: 'PRINCIPAL',
      items: [
        { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
        { label: 'Empresas', to: '/empresas', icon: Building2 },
        { label: 'Documentos', to: '/documentos', icon: FileText },
        { label: 'Workflow', to: '/workflow', icon: GitPullRequest },
        {
          label: 'Obrigações',
          to: '/obrigacoes',
          icon: Clock,
          badge: obrigacoesBadgeCount > 0 ? obrigacoesBadgeCount : undefined,
        },
        { label: 'Fiscal', to: '/fiscal', icon: Calculator },
        { label: 'Depto. Pessoal (DP)', to: '/departamento-pessoal', icon: Users },
        { label: 'Impostos Retidos (Folha)', to: '/impostos-retidos', icon: Receipt },
      ],
    },
    {
      group: 'FINANCEIRO',
      items: [
        { label: 'Contas & Conciliação', to: '/financeiro', icon: Wallet },
        { label: 'Fluxo de Caixa & DFC', to: '/fluxo-caixa', icon: TrendingUp },
      ],
    },
    {
      group: 'CONTÁBIL',
      items: [
        { label: 'Fecho Mensal', to: '/fecho-mensal', icon: CheckSquare },
        { label: 'Lançamentos', to: '/contabil/lancamentos', icon: BookOpen },
        { label: 'Pré-Lançamento', to: '/contabil/pre-lancamento', icon: Sparkles },
        { label: 'Balancete', to: '/contabil/balancete', icon: FileSpreadsheet },
        { label: 'DRE & Balanço', to: '/relatorios-contabeis', icon: PieChart },
        { label: 'Patrimônio (Ativos)', to: '/patrimonio', icon: Boxes },
        { label: 'Mapeamento Fecho', to: '/contabil/mapeamento', icon: Compass },
      ],
    },
    {
      group: 'GESTÃO',
      items: [
        { label: 'Portal do Cliente', to: '/portal-acessos', icon: Users },
        { label: 'Relatórios', to: '/relatorios', icon: Layers },
        { label: 'Usuários & Perfis', to: '/usuarios', icon: Users },
        { label: 'Auditoria', to: '/auditoria', icon: ShieldCheck },
        { label: 'Integrações', to: '/integracoes', icon: Compass },
      ],
    },
  ]

  const userAvatarUrl = user?.avatar ? pb.files.getURL(user, user.avatar) : undefined

  const userInitials = (user?.name || user?.email || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex min-h-screen bg-[#F6F7F9] text-[#1A2333]">
      {/* Desktop Sidebar (264px or 72px) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-[#123B6D]/40 bg-[#0B1F3A] text-white transition-all duration-300 md:flex',
          collapsed ? 'w-[72px]' : 'w-[264px]',
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-[#123B6D]/60">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0FA3A3] to-[#123B6D] text-white shadow-md">
              <Compass className="h-6 w-6" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-white">Rumo</span>
                <span className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
                  Consultoria Contábil
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#94A3B8] hover:bg-[#123B6D] hover:text-white"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navGroups.map((g) => (
            <div key={g.group} className="space-y-1">
              {!collapsed && (
                <p className="px-3 text-[11px] font-semibold tracking-wider text-[#94A3B8]">
                  {g.group}
                </p>
              )}
              {g.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                        isActive
                          ? 'border-l-4 border-[#0FA3A3] bg-[#123B6D] text-white font-semibold'
                          : 'text-[#94A3B8] hover:bg-[#123B6D]/50 hover:text-white',
                        collapsed && 'justify-center px-0',
                      )
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-105" />
                      {!collapsed && <span>{item.label}</span>}
                    </div>
                    {!collapsed && item.badge && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white shadow-xs">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer Sidebar Entry: Rumo Agent highlight */}
        <div className="border-t border-[#123B6D]/60 p-3">
          <NavLink
            to="/rumo-agent"
            className={({ isActive }) =>
              cn(
                'group flex items-center justify-between rounded-xl p-2.5 text-sm font-medium transition-all shadow-sm',
                isActive
                  ? 'bg-gradient-to-r from-[#0FA3A3] to-[#0C8585] text-white ring-2 ring-[#0FA3A3]/50'
                  : 'bg-[#123B6D]/60 text-white hover:bg-[#123B6D]',
                collapsed && 'justify-center p-2',
              )
            }
            title={collapsed ? 'Rumo Agent (IA)' : undefined}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0FA3A3]/20 text-[#0FA3A3] group-hover:bg-[#0FA3A3]/30">
                <Sparkles className="h-4 w-4 text-[#0FA3A3]" />
              </div>
              {!collapsed && (
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-white">Rumo Agent</span>
                  <span className="text-[11px] text-[#94A3B8]">Assistente IA Contábil</span>
                </div>
              )}
            </div>
            {!collapsed && (
              <Badge className="bg-[#0FA3A3] hover:bg-[#0FA3A3] text-white text-[10px] font-bold px-1.5 py-0.5 uppercase tracking-wide">
                NOVO
              </Badge>
            )}
          </NavLink>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex w-[280px] flex-col bg-[#0B1F3A] text-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-[#123B6D] px-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0FA3A3] text-white">
                  <Compass className="h-5 w-5" />
                </div>
                <span className="font-bold text-white">Rumo Contábil</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-[#94A3B8] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {navGroups.map((g) => (
                <div key={g.group} className="space-y-1">
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                    {g.group}
                  </p>
                  {g.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium',
                            isActive
                              ? 'bg-[#123B6D] text-white font-semibold'
                              : 'text-[#94A3B8] hover:bg-[#123B6D]/50 hover:text-white',
                          )
                        }
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white shadow-xs">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    )
                  })}
                </div>
              ))}
              <div className="pt-2">
                <NavLink
                  to="/rumo-agent"
                  className="flex items-center justify-between rounded-lg bg-[#123B6D] p-3 text-sm font-medium text-white"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-[#0FA3A3]" />
                    <span>Rumo Agent</span>
                  </div>
                  <Badge className="bg-[#0FA3A3] text-white text-[10px]">NOVO</Badge>
                </NavLink>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div
        className={cn(
          'flex flex-1 flex-col transition-all duration-300 min-w-0',
          collapsed ? 'md:pl-[72px]' : 'md:pl-[264px]',
        )}
      >
        {/* Sticky Topbar (64px) */}
        <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-[#E2E8F0] bg-white px-4 md:px-8 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E2E8F0] text-[#64748B] hover:bg-slate-100 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-[#1A2333]">
              {getPageTitle()}
            </h1>
          </div>

          {/* Center: Global Search */}
          <div className="relative hidden w-80 lg:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar empresas, CNPJ ou documentos..."
                className="h-9 pl-9 pr-4 text-xs rounded-lg border-[#E2E8F0] bg-[#F6F7F9] focus:bg-white focus:border-[#0FA3A3]"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setSearchResultsOpen(false)
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#1A2333]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Global Search Results Popup */}
            {searchResultsOpen && (
              <div className="absolute left-0 top-11 z-50 w-96 rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-xl">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <span className="text-xs font-semibold text-[#64748B]">Resultados da Busca</span>
                  <span className="text-[10px] text-[#94A3B8]">Escopo: {tenant?.nome}</span>
                </div>

                <div className="max-h-80 overflow-y-auto space-y-3">
                  {matchingEmpresas.length === 0 && matchingDocumentos.length === 0 ? (
                    <p className="py-4 text-center text-xs text-[#94A3B8]">
                      Nenhum resultado encontrado para &quot;{searchQuery}&quot;
                    </p>
                  ) : (
                    <>
                      {matchingEmpresas.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-[#0FA3A3] uppercase tracking-wider mb-1">
                            Empresas ({matchingEmpresas.length})
                          </p>
                          <div className="space-y-1">
                            {matchingEmpresas.map((emp) => (
                              <button
                                key={emp.id}
                                onClick={() => {
                                  navigate(`/empresas/${emp.id}`)
                                  setSearchResultsOpen(false)
                                  setSearchQuery('')
                                }}
                                className="flex w-full items-center justify-between rounded-lg p-2 text-left text-xs hover:bg-slate-50 transition-colors"
                              >
                                <div>
                                  <p className="font-semibold text-[#1A2333]">
                                    {emp.nome_fantasia || emp.razao_social}
                                  </p>
                                  <p className="text-[10px] text-[#64748B]">CNPJ: {emp.cnpj}</p>
                                </div>
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {emp.status}
                                </Badge>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {matchingDocumentos.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-[#3B82F6] uppercase tracking-wider mb-1">
                            Documentos ({matchingDocumentos.length})
                          </p>
                          <div className="space-y-1">
                            {matchingDocumentos.map((doc) => (
                              <button
                                key={doc.id}
                                onClick={() => {
                                  navigate('/documentos')
                                  setSearchResultsOpen(false)
                                  setSearchQuery('')
                                }}
                                className="flex w-full items-center justify-between rounded-lg p-2 text-left text-xs hover:bg-slate-50 transition-colors"
                              >
                                <div className="truncate pr-2">
                                  <p className="font-medium text-[#1A2333] truncate">
                                    {doc.nome_arquivo}
                                  </p>
                                  <p className="text-[10px] text-[#64748B]">Tipo: {doc.tipo}</p>
                                </div>
                                <Badge
                                  className={cn(
                                    'text-[10px]',
                                    doc.status === 'processado'
                                      ? 'bg-[#DCFCE7] text-[#22C55E]'
                                      : 'bg-[#FEF3C7] text-[#F59E0B]',
                                  )}
                                >
                                  {doc.status}
                                </Badge>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Controls: Tenant Switcher, Notifications, Avatar Dropdown */}
          <div className="flex items-center gap-3">
            {/* Tenant switcher */}
            {tenants.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2 border-[#E2E8F0] bg-slate-50 text-xs font-semibold hover:bg-slate-100"
                  >
                    <Building2 className="h-3.5 w-3.5 text-[#0FA3A3]" />
                    <span className="max-w-[120px] truncate">{tenant?.nome || 'Escritório'}</span>
                    <ChevronDown className="h-3 w-3 text-[#94A3B8]" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs text-[#64748B]">
                    Alternar Escritório
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {tenants.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onClick={() => switchTenant(t)}
                      className={cn(
                        'flex items-center justify-between text-xs cursor-pointer',
                        t.id === tenant?.id && 'bg-slate-100 font-bold text-[#0FA3A3]',
                      )}
                    >
                      <span className="truncate">{t.nome}</span>
                      {t.id === tenant?.id && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#0FA3A3]" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden sm:flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F6F7F9] px-3 py-1.5 text-xs text-[#64748B]">
                <Building2 className="h-3.5 w-3.5 text-[#0FA3A3]" />
                <span className="font-semibold text-[#1A2333] max-w-[140px] truncate">
                  {tenant?.nome || 'Rumo Consultoria'}
                </span>
              </div>
            )}

            {/* Notification Bell with Live Feed */}
            <DropdownMenu open={notifDropdownOpen} onOpenChange={setNotifDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 text-[#64748B] hover:bg-slate-100"
                  aria-label="Notificações"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF4444] text-[9px] font-bold text-white shadow-xs">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-80 sm:w-96 rounded-2xl p-0 shadow-xl border-[#E2E8F0]"
              >
                <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3 bg-slate-50/60 rounded-t-2xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#1A2333]">
                      Central de Notificações
                    </span>
                    {unreadCount > 0 && (
                      <Badge className="bg-[#0FA3A3] text-white text-[10px] px-1.5 py-0">
                        {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[11px] font-semibold text-[#0FA3A3] hover:underline"
                    >
                      Marcar todas como lidas
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-1">
                  {notificacoes.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#94A3B8]">
                      Nenhuma notificação no momento.
                    </div>
                  ) : (
                    notificacoes.map((notif) => {
                      const isUnread = !notif.lida
                      const isOverdue = notif.tipo === 'atrasada'
                      const isWarning = notif.tipo === 'prazo_proximo'

                      return (
                        <div
                          key={notif.id}
                          onClick={() => handleMarkAsRead(notif.id, notif.link)}
                          className={cn(
                            'flex items-start gap-3 p-3 transition-colors rounded-xl cursor-pointer',
                            isUnread ? 'bg-sky-50/50 hover:bg-sky-50' : 'hover:bg-slate-50',
                          )}
                        >
                          <div className="shrink-0 mt-0.5">
                            {isOverdue ? (
                              <div className="h-7 w-7 rounded-lg bg-red-100 text-[#DC2626] flex items-center justify-center">
                                <AlertTriangle className="h-4 w-4" />
                              </div>
                            ) : isWarning ? (
                              <div className="h-7 w-7 rounded-lg bg-amber-100 text-[#D97706] flex items-center justify-center">
                                <Clock className="h-4 w-4" />
                              </div>
                            ) : (
                              <div className="h-7 w-7 rounded-lg bg-teal-100 text-[#0FA3A3] flex items-center justify-center">
                                <CheckCircle2 className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p
                                className={cn(
                                  'text-xs truncate',
                                  isUnread
                                    ? 'font-bold text-[#1A2333]'
                                    : 'font-medium text-[#64748B]',
                                )}
                              >
                                {notif.titulo}
                              </p>
                              {isUnread && (
                                <span className="h-2 w-2 rounded-full bg-[#0FA3A3] shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-[#64748B] line-clamp-2 mt-0.5">
                              {notif.mensagem}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                <div className="border-t border-[#E2E8F0] p-2 bg-slate-50 text-center rounded-b-2xl">
                  <NavLink
                    to="/obrigacoes"
                    onClick={() => setNotifDropdownOpen(false)}
                    className="text-[11px] font-semibold text-[#0FA3A3] hover:underline"
                  >
                    Ver calendário de obrigações →
                  </NavLink>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Avatar Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-[#0FA3A3]/30 transition-all focus:outline-hidden"
                  aria-label="Menu do usuário"
                >
                  <Avatar className="h-9 w-9 border border-[#E2E8F0]">
                    <AvatarImage src={userAvatarUrl} />
                    <AvatarFallback className="bg-[#0B1F3A] text-white text-xs font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold leading-none text-[#1A2333]">
                      {user?.name || 'Usuário'}
                    </p>
                    <p className="text-xs leading-none text-[#64748B]">{user?.email}</p>
                    {member && (
                      <Badge className="w-fit mt-1 text-[10px] bg-[#0FA3A3] text-white uppercase">
                        {member.perfil}
                      </Badge>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate('/perfil')}
                  className="cursor-pointer text-xs flex items-center gap-2"
                >
                  <UserIcon className="h-3.5 w-3.5 text-[#64748B]" />
                  <span>Minha Conta</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/usuarios')}
                  className="cursor-pointer text-xs flex items-center gap-2"
                >
                  <Users className="h-3.5 w-3.5 text-[#64748B]" />
                  <span>Gerenciar Usuários</span>
                </DropdownMenuItem>
                {member?.perfil === 'administrador' && (
                  <DropdownMenuItem
                    onClick={() => {
                      setNomeNovoEscritorio('')
                      setCnpjNovoEscritorio('')
                      setModalNovoEscritorioOpen(true)
                    }}
                    className="cursor-pointer text-xs flex items-center gap-2 text-[#0FA3A3] focus:text-[#0FA3A3]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Novo Escritório</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={signOut}
                  className="cursor-pointer text-xs text-[#EF4444] focus:text-[#EF4444] flex items-center gap-2"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sair da Plataforma</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content Area (Max 1440px centered, 24px padding) */}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-[1440px]">
            <Outlet />
          </div>
        </main>

        {/* Global Footer */}
        <footer className="border-t border-[#E2E8F0] bg-white px-4 py-4 md:px-8">
          <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-2 sm:flex-row text-xs text-[#64748B]">
            <p>© 2025 Rumo Consultoria Contábil. Todos os direitos reservados.</p>
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#1A2333]">
                v0.1.0 (MVP)
              </span>
              <span className="text-[11px] text-[#94A3B8]">Plataforma Segura SSL</span>
            </div>
          </div>
        </footer>
      </div>

      {/* DIÁLOGO: NOVO ESCRITÓRIO (MULTI-TENANT) */}
      <Dialog open={modalNovoEscritorioOpen} onOpenChange={setModalNovoEscritorioOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A2333]">
              Cadastrar Novo Escritório Contábil
            </DialogTitle>
            <DialogDescription className="text-xs">
              Crie uma organização independente com isolamento total de dados, empresas e auditoria.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!nomeNovoEscritorio.trim()) return
              setCriandoEscritorio(true)
              try {
                const novo = await createEscritorio(nomeNovoEscritorio, cnpjNovoEscritorio)
                toast({
                  title: 'Escritório criado com sucesso!',
                  description: `Você foi conectado ao tenant ${novo.nome}.`,
                })
                setModalNovoEscritorioOpen(false)
                navigate('/dashboard', { replace: true, state: { showOnboarding: true } })
              } catch (err) {
                console.error('Erro ao criar novo escritório:', err)
                toast({
                  variant: 'destructive',
                  title: 'Erro ao criar escritório',
                  description: 'Não foi possível cadastrar a nova organização.',
                })
              } finally {
                setCriandoEscritorio(false)
              }
            }}
            className="space-y-4 py-2 text-xs"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome do Escritório / Razão Social *</Label>
              <Input
                required
                value={nomeNovoEscritorio}
                onChange={(e) => setNomeNovoEscritorio(e.target.value)}
                placeholder="Ex: Prime Contabilidade & BPO Ltda"
                className="h-9 rounded-xl border-[#E2E8F0] text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">CNPJ do Escritório (Opcional)</Label>
              <Input
                value={cnpjNovoEscritorio}
                onChange={(e) => setCnpjNovoEscritorio(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="h-9 rounded-xl border-[#E2E8F0] text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalNovoEscritorioOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={criandoEscritorio || !nomeNovoEscritorio.trim()}
                className="rounded-xl bg-[#0FA3A3] text-white hover:bg-[#0C8585] text-xs"
              >
                {criandoEscritorio ? 'Criando organização...' : 'Criar e Acessar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

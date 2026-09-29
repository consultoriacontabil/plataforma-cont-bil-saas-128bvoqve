import React, { useState, useEffect, useCallback } from 'react'
import {
  Users,
  UserPlus,
  Shield,
  MoreVertical,
  CheckCircle2,
  Clock,
  Trash2,
  Edit,
  Mail,
  Loader2,
  Lock,
  Bot,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { usersService } from '@/services/users'
import { ellizaDiretivasService } from '@/services/ellizaDiretivas'
import { formatDatePtBr } from '@/lib/formatters'
import type { TenantMember, UserRole, EllizaPerfilRecord } from '@/types'
import { Link } from 'react-router-dom'
import { ExternalLink, Cpu, Activity, Sliders, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'

export default function Usuarios() {
  const { user, tenant, member } = useAuth()
  const { toast } = useToast()

  const [members, setMembers] = useState<TenantMember[]>([])
  const [ellizaPerfil, setEllizaPerfil] = useState<EllizaPerfilRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingPerfil, setLoadingPerfil] = useState(true)

  // Invite modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('auxiliar')
  const [inviting, setInviting] = useState(false)

  // Edit role modal
  const [memberToEdit, setMemberToEdit] = useState<TenantMember | null>(null)
  const [editRole, setEditRole] = useState<UserRole>('auxiliar')
  const [updatingRole, setUpdatingRole] = useState(false)

  // Delete modal
  const [memberToDelete, setMemberToDelete] = useState<TenantMember | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadMembers = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      // Carregar apenas membros humanos (exclui conta elliza se houver)
      const res = await usersService.listMembers(tenant.id)
      const apenasHumanos = res.filter(
        (m) =>
          m.perfil !== 'elliza' &&
          m.expand?.user_id?.email !== 'elliza@rumo.contabil' &&
          !(m.expand?.user_id?.name || '').includes('[SERVIÇO INTERNO DESATIVADO]'),
      )
      setMembers(apenasHumanos)
    } catch (err) {
      console.error('Error loading members:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao listar usuários',
      })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, toast])

  const loadEllizaPerfil = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoadingPerfil(true)
      const perfil = await ellizaDiretivasService.getPerfilOperacional(tenant.id)
      setEllizaPerfil(perfil)
    } catch (err) {
      console.error('Error loading ELLIZA perfil:', err)
    } finally {
      setLoadingPerfil(false)
    }
  }, [tenant?.id])

  useEffect(() => {
    loadMembers()
    loadEllizaPerfil()
  }, [loadMembers, loadEllizaPerfil])

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id) return
    setInviting(true)
    try {
      await usersService.inviteUser(tenant.id, inviteName.trim(), inviteEmail.trim(), inviteRole)
      toast({
        title: 'Convite enviado!',
        description: `O usuário ${inviteName} foi adicionado com status convite pendente.`,
      })
      setInviteModalOpen(false)
      setInviteName('')
      setInviteEmail('')
      loadMembers()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao convidar usuário.'
      toast({
        variant: 'destructive',
        title: 'Erro no convite',
        description: msg,
      })
    } finally {
      setInviting(false)
    }
  }

  const handleUpdateRole = async () => {
    if (!memberToEdit) return
    setUpdatingRole(true)
    try {
      await usersService.updateMemberRole(memberToEdit.id, editRole)
      toast({
        title: 'Perfil atualizado!',
        description: `O perfil foi alterado para ${editRole}.`,
      })
      setMemberToEdit(null)
      loadMembers()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar perfil',
      })
    } finally {
      setUpdatingRole(false)
    }
  }

  const handleDeleteMember = async () => {
    if (!memberToDelete) return
    setDeleting(true)
    try {
      await usersService.removeMember(memberToDelete.id)
      toast({
        title: 'Membro removido',
        description: 'O acesso do usuário a este escritório foi revogado.',
      })
      setMemberToDelete(null)
      loadMembers()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover usuário',
      })
    } finally {
      setDeleting(false)
    }
  }

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'administrador':
        return <Badge className="bg-[#0B1F3A] text-white">Administrador</Badge>
      case 'contador':
        return <Badge className="bg-[#0FA3A3] text-white">Contador</Badge>
      case 'auxiliar':
        return <Badge className="bg-[#3B82F6] text-white">Auxiliar</Badge>
      case 'consultor':
        return <Badge className="bg-slate-200 text-slate-700">Consultor</Badge>
      case 'cliente':
        return (
          <Badge variant="outline" className="border-indigo-300 text-indigo-700 bg-indigo-50">
            Cliente
          </Badge>
        )
      case 'elliza':
        return (
          <Badge className="bg-gradient-to-r from-teal-600 to-[#0FA3A3] text-white gap-1 shadow-2xs font-bold border-teal-500">
            <Bot className="h-3 w-3" />
            ELLIZA (Agente IA)
          </Badge>
        )
      default:
        return <Badge variant="secondary">{role}</Badge>
    }
  }

  const isAdmin = member?.perfil === 'administrador'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">Usuários & Perfis</h2>
          <p className="text-xs text-[#64748B]">
            Gerenciamento de membros da equipe e matriz de controle de acesso (RBAC)
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setInviteModalOpen(true)}
            className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-10 shadow-xs"
          >
            <UserPlus className="h-4 w-4" />
            <span>Convidar Usuário</span>
          </Button>
        )}
      </div>

      <Tabs defaultValue="usuarios" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl h-11">
          <TabsTrigger value="usuarios" className="rounded-lg text-xs font-semibold gap-2">
            <Users className="h-4 w-4" />
            <span>Membros do Escritório ({members.length})</span>
          </TabsTrigger>
          <TabsTrigger value="perfis" className="rounded-lg text-xs font-semibold gap-2">
            <Shield className="h-4 w-4" />
            <span>Perfis e Permissões</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Usuários */}
        <TabsContent value="usuarios" className="space-y-6">
          {/* SEÇÃO PRÓPRIA: PERFIL OPERACIONAL DA ELLIZA (NÃO HUMANO) */}
          <Card className="rounded-2xl border-2 border-teal-500/40 bg-gradient-to-br from-teal-50/70 via-slate-50 to-emerald-50/40 shadow-xs overflow-hidden">
            <CardHeader className="pb-3 border-b border-teal-100 bg-teal-50/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-600 to-[#0FA3A3] text-white flex items-center justify-center shadow-xs">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-sm font-bold text-[#1A2333]">
                        Perfil Operacional — {ellizaPerfil?.nome_exibicao || 'ELLIZA (Agente IA)'}
                      </CardTitle>
                      <Badge className="bg-[#0FA3A3] text-white text-[10px] gap-1 font-bold">
                        <Sparkles className="h-2.5 w-2.5" />
                        Agente de Serviço Não Humano
                      </Badge>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold">
                        Status: {ellizaPerfil?.status === 'ativo' ? '24/7 Ativo' : 'Operacional'}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-[#64748B] mt-0.5">
                      Identidade autônoma de automação do escritório contábil (desacoplada de contas
                      de usuários humanos).
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs rounded-xl border-teal-300 text-teal-800 bg-white hover:bg-teal-50 h-8 font-semibold shadow-2xs"
                  >
                    <Link to="/elliza">
                      <Sliders className="h-3.5 w-3.5" />
                      <span>Gerenciar Diretivas</span>
                      <ExternalLink className="h-3 w-3 ml-0.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-white/80 border border-teal-100 space-y-1">
                <div className="flex items-center gap-2 text-teal-800 font-semibold">
                  <Cpu className="h-4 w-4 text-[#0FA3A3]" />
                  <span>Motor de Execução</span>
                </div>
                <p className="text-slate-600">
                  Agente nativo Skip Cloud (
                  <span className="font-mono text-[11px] text-teal-700">slug: elliza</span>) com
                  rotinas de monitoramento 24/7 em background.
                </p>
                <div className="pt-1 text-[11px] text-slate-500">
                  Versão:{' '}
                  <strong className="text-slate-700">
                    {ellizaPerfil?.versao_motor || 'v1.4.2-skip247'}
                  </strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/80 border border-teal-100 space-y-1">
                <div className="flex items-center gap-2 text-teal-800 font-semibold">
                  <Activity className="h-4 w-4 text-[#0FA3A3]" />
                  <span>Escopo de Autonomia</span>
                </div>
                <p className="text-slate-600">
                  Opera conforme matriz de diretivas por tenant: folha DP, apuração fiscal,
                  pré-lançamentos, WhatsApp ativo e cobranças.
                </p>
                <div className="pt-1 text-[11px] text-slate-500">
                  Modo Padrão: <strong className="text-teal-700">Autônomo com Supervisão</strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/80 border border-teal-100 space-y-1">
                <div className="flex items-center gap-2 text-teal-800 font-semibold">
                  <ShieldCheck className="h-4 w-4 text-[#0FA3A3]" />
                  <span>Conformidade CFC & Isolamento</span>
                </div>
                <p className="text-slate-600">
                  Transmissões oficiais e atos vinculantes sempre requerem aprovação expressa do
                  Contador responsável técnico (NBC PP 01).
                </p>
                <div className="pt-1 text-[11px] text-emerald-700 font-medium">
                  • 0 contas humanas vinculadas
                </div>
              </div>
            </CardContent>
          </Card>

          {/* LISTA DE MEMBROS HUMANOS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1A2333]">
                  Colaboradores e Usuários Humanos
                </h3>
                <p className="text-xs text-[#64748B]">
                  Pessoas físicas com credenciais de login e acesso ao painel do escritório
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {members.length} {members.length === 1 ? 'membro' : 'membros'}
              </Badge>
            </div>

            <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                        <th className="py-3.5 px-4">Nome do Usuário</th>
                        <th className="py-3.5 px-4">E-mail</th>
                        <th className="py-3.5 px-4">Perfil</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Data de Entrada</th>
                        {isAdmin && <th className="py-3.5 px-4 text-right">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-[#64748B]">
                            Carregando equipe...
                          </td>
                        </tr>
                      ) : members.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-[#94A3B8]">
                            Nenhum usuário cadastrado.
                          </td>
                        </tr>
                      ) : (
                        members.map((m) => {
                          const initials = (
                            m.expand?.user_id?.name ||
                            m.expand?.user_id?.email ||
                            'U'
                          )
                            .slice(0, 2)
                            .toUpperCase()

                          return (
                            <tr key={m.id} className="transition-colors hover:bg-slate-50/75">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs font-bold text-white bg-[#0B1F3A]">
                                      {initials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="font-semibold text-[#1A2333]">
                                        {m.expand?.user_id?.name || 'Sem nome'}
                                      </p>
                                      {m.user_id === user?.id && (
                                        <span className="text-[10px] text-[#0FA3A3] font-semibold">
                                          (Você)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-[#64748B]">
                                {m.expand?.user_id?.email}
                              </td>
                              <td className="py-3 px-4">{getRoleBadge(m.perfil)}</td>
                              <td className="py-3 px-4">
                                {m.status === 'ativo' ? (
                                  <Badge className="bg-[#DCFCE7] text-[#166534]">Ativo</Badge>
                                ) : (
                                  <Badge className="bg-[#FEF3C7] text-[#92400E]">
                                    Convite Pendente
                                  </Badge>
                                )}
                              </td>
                              <td className="py-3 px-4 text-[#64748B]">
                                {formatDatePtBr(m.created)}
                              </td>
                              {isAdmin && (
                                <td className="py-3 px-4 text-right">
                                  {m.user_id !== user?.id ? (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-[#64748B]"
                                        >
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-40">
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setMemberToEdit(m)
                                            setEditRole(m.perfil)
                                          }}
                                          className="gap-2 text-xs cursor-pointer"
                                        >
                                          <Edit className="h-3.5 w-3.5 text-[#3B82F6]" />
                                          <span>Editar perfil</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => setMemberToDelete(m)}
                                          className="gap-2 text-xs text-red-600 focus:text-red-600 cursor-pointer"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          <span>Remover acesso</span>
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  ) : null}
                                </td>
                              )}
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Perfis e Matriz RBAC */}
        <TabsContent value="perfis" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {/* Administrador */}
            <Card className="rounded-2xl border-l-4 border-l-[#0B1F3A] border-[#E2E8F0] shadow-xs">
              <CardHeader className="pb-3">
                <Badge className="w-fit bg-[#0B1F3A] text-white">Administrador</Badge>
                <CardTitle className="text-sm font-bold text-[#1A2333] mt-2">
                  Acesso Total
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Proprietários e sócios do escritório de contabilidade
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs space-y-2 border-t pt-3">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Cadastra/Edita/Exclui empresas</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Upload e exclusão de GED</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Transmissão fiscal e workflows</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Gerencia usuários e convites</span>
                </div>
              </CardContent>
            </Card>

            {/* Contador */}
            <Card className="rounded-2xl border-l-4 border-l-[#0FA3A3] border-[#E2E8F0] shadow-xs">
              <CardHeader className="pb-3">
                <Badge className="w-fit bg-[#0FA3A3] text-white">Contador</Badge>
                <CardTitle className="text-sm font-bold text-[#1A2333] mt-2">
                  Operacional Completo
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Contadores responsáveis técnicos pelas rotinas
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs space-y-2 border-t pt-3">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Cadastra e edita empresas</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Upload e conferência GED</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Gera obrigações e recibos</span>
                </div>
                <div className="flex items-center gap-2 text-[#94A3B8]">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Não gerencia outros usuários</span>
                </div>
              </CardContent>
            </Card>

            {/* Auxiliar */}
            <Card className="rounded-2xl border-l-4 border-l-[#3B82F6] border-[#E2E8F0] shadow-xs">
              <CardHeader className="pb-3">
                <Badge className="w-fit bg-[#3B82F6] text-white">Auxiliar</Badge>
                <CardTitle className="text-sm font-bold text-[#1A2333] mt-2">
                  Assistente Contábil
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Equipe de apoio em digitação e workflows
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs space-y-2 border-t pt-3">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Visualiza empresas e fiscal</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Cria e atualiza workflows</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Envia documentos no GED</span>
                </div>
                <div className="flex items-center gap-2 text-[#94A3B8]">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Sem exclusão de cadastros</span>
                </div>
              </CardContent>
            </Card>

            {/* Consultor */}
            <Card className="rounded-2xl border-l-4 border-l-slate-400 border-[#E2E8F0] shadow-xs">
              <CardHeader className="pb-3">
                <Badge variant="secondary" className="w-fit text-slate-700">
                  Consultor
                </Badge>
                <CardTitle className="text-sm font-bold text-[#1A2333] mt-2">
                  Somente Leitura
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Auditores externos ou clientes em modo consulta
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs space-y-2 border-t pt-3">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Consulta de empresas e notas</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Download de documentos GED</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Acesso ao Rumo Agent</span>
                </div>
                <div className="flex items-center gap-2 text-[#94A3B8]">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Sem permissão de gravação</span>
                </div>
              </CardContent>
            </Card>

            {/* ELLIZA (Motor Automatizado) */}
            <Card className="rounded-2xl border-l-4 border-l-[#0FA3A3] border-teal-200 bg-teal-50/20 shadow-xs">
              <CardHeader className="pb-3">
                <Badge className="w-fit bg-[#0FA3A3] text-white flex items-center gap-1">
                  <Bot className="h-3 w-3" />
                  ELLIZA (Agente IA)
                </Badge>
                <CardTitle className="text-sm font-bold text-[#1A2333] mt-2">
                  Motor Autônomo 24/7
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Perfil operacional de serviço para rotinas em segundo plano
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs space-y-2 border-t pt-3">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Opera sob diretivas de autonomia</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Enfileira ações para aprovação</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Auditoria e varredura de prazos</span>
                </div>
                <div className="flex items-center gap-2 text-teal-800 font-semibold">
                  <Bot className="h-3.5 w-3.5 text-[#0FA3A3]" />
                  <span>Conta de serviço não humana</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal: Convidar Usuário */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-[#1A2333]">Convidar Usuário</DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              O colaborador receberá o convite para acesso ao escritório
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInviteSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv_nome" className="text-xs font-semibold text-[#1A2333]">
                Nome Completo *
              </Label>
              <Input
                id="inv_nome"
                required
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Ex: Mariana Ferreira"
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv_email" className="text-xs font-semibold text-[#1A2333]">
                E-mail Corporativo *
              </Label>
              <Input
                id="inv_email"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="mariana@rumoconsultoria.com.br"
                className="h-10 text-xs rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">Perfil de Acesso</Label>
              <Select value={inviteRole} onValueChange={(val: UserRole) => setInviteRole(val)}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrador">Administrador (Total)</SelectItem>
                  <SelectItem value="contador">Contador</SelectItem>
                  <SelectItem value="auxiliar">Auxiliar Contábil</SelectItem>
                  <SelectItem value="consultor">Consultor (Somente Leitura)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={inviting}
                className="gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs shadow-xs"
              >
                {inviting ? 'Enviando convite...' : 'Enviar Convite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Perfil */}
      <Dialog open={Boolean(memberToEdit)} onOpenChange={() => setMemberToEdit(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base text-[#1A2333]">Alterar Perfil de Acesso</DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Selecione o novo papel para{' '}
              <strong>{memberToEdit?.expand?.user_id?.name || 'o usuário'}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1A2333]">Novo Perfil</Label>
              <Select value={editRole} onValueChange={(val: UserRole) => setEditRole(val)}>
                <SelectTrigger className="h-10 text-xs rounded-xl border-[#E2E8F0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrador">Administrador</SelectItem>
                  <SelectItem value="contador">Contador</SelectItem>
                  <SelectItem value="auxiliar">Auxiliar Contábil</SelectItem>
                  <SelectItem value="consultor">Consultor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setMemberToEdit(null)}
              className="text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={updatingRole}
              className="text-xs rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white"
            >
              {updatingRole ? 'Salvando...' : 'Salvar Perfil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar Remoção */}
      <Dialog open={Boolean(memberToDelete)} onOpenChange={() => setMemberToDelete(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-[#1A2333]">Remover Colaborador</DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Tem certeza que deseja revogar o acesso de{' '}
              <strong>
                {memberToDelete?.expand?.user_id?.name || memberToDelete?.expand?.user_id?.email}
              </strong>{' '}
              ao escritório? Ele deixará de ter visibilidade dos dados das empresas.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setMemberToDelete(null)}
              className="text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDeleteMember}
              className="text-xs rounded-xl"
            >
              {deleting ? 'Removendo...' : 'Confirmar Remoção'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

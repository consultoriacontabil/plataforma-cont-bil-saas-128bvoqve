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
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usersService } from '@/services/users'
import { formatDatePtBr } from '@/lib/formatters'
import type { TenantMember, UserRole } from '@/types'
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
  const [loading, setLoading] = useState(true)

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
      const res = await usersService.listMembers(tenant.id)
      setMembers(res)
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

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

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
        <TabsContent value="usuarios">
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
                          <tr key={m.id} className="hover:bg-slate-50/75 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-[#0B1F3A] text-white text-xs font-bold">
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
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
                            </td>
                            <td className="py-3 px-4 text-[#64748B]">{m.expand?.user_id?.email}</td>
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
                                {m.user_id !== user?.id && (
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
                                )}
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
        </TabsContent>

        {/* Tab 2: Perfis e Matriz RBAC */}
        <TabsContent value="perfis" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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

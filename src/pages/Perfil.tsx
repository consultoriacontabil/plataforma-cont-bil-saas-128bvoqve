import React, { useState } from 'react'
import {
  User as UserIcon,
  Mail,
  Lock,
  Upload,
  CheckCircle2,
  Loader2,
  Building2,
  Shield,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usersService } from '@/services/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'

export default function Perfil() {
  const { user, tenant, member, refreshAuth } = useAuth()
  const { toast } = useToast()

  // Profile data
  const [name, setName] = useState(user?.name || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  // Notification email preference
  const [emailNotifPrazo, setEmailNotifPrazo] = useState<boolean>(
    user?.email_notificacoes_prazo !== false,
  )
  const [savingPref, setSavingPref] = useState(false)

  // Password data
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSavingProfile(true)
    try {
      const formData = new FormData()
      formData.append('name', name.trim())
      if (avatarFile) {
        formData.append('avatar', avatarFile)
      }

      await usersService.updateProfile(user.id, formData)
      await refreshAuth()
      toast({
        title: 'Perfil atualizado!',
        description: 'Suas informações cadastrais foram salvas.',
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar perfil',
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleToggleEmailNotif = async (checked: boolean) => {
    if (!user) return
    setEmailNotifPrazo(checked)
    setSavingPref(true)
    try {
      await pb.collection('users').update(user.id, {
        email_notificacoes_prazo: checked,
      })
      await refreshAuth()
      toast({
        title: 'Preferência atualizada',
        description: checked
          ? 'Você receberá e-mails de lembretes e prazos de obrigações/workflows.'
          : 'Lembretes por e-mail desativados.',
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar preferência',
      })
    } finally {
      setSavingPref(false)
    }
  }

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (newPassword.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Senha muito curta',
        description: 'A nova senha deve ter pelo menos 8 caracteres.',
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Senhas não conferem',
        description: 'A confirmação de senha é diferente da nova senha.',
      })
      return
    }

    setSavingPassword(true)
    try {
      await pb.collection('users').update(user.id, {
        oldPassword: oldPassword,
        password: newPassword,
        passwordConfirm: confirmPassword,
      })

      toast({
        title: 'Senha alterada com sucesso!',
        description: 'Utilize sua nova senha no próximo acesso.',
      })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao alterar senha.'
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar senha',
        description: 'Verifique se a senha atual está correta.',
      })
    } finally {
      setSavingPassword(false)
    }
  }

  const userAvatarUrl = avatarPreview
    ? avatarPreview
    : user?.avatar
      ? pb.files.getURL(user, user.avatar)
      : undefined

  const userInitials = (user?.name || user?.email || 'U').slice(0, 2).toUpperCase()

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[#1A2333]">Minha Conta</h2>
        <p className="text-xs text-[#64748B]">
          Gerencie suas preferências pessoais e credenciais de segurança
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Card 1: Dados Pessoais & Avatar */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#1A2333]">Dados Pessoais</CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Nome de exibição e foto do perfil
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border border-[#E2E8F0]">
                  <AvatarImage src={userAvatarUrl} />
                  <AvatarFallback className="bg-[#0B1F3A] text-white text-base font-bold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Label
                    htmlFor="avatar_upload"
                    className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#1A2333] hover:bg-slate-50 shadow-2xs"
                  >
                    <Upload className="h-3.5 w-3.5 text-[#0FA3A3]" />
                    <span>Alterar Foto</span>
                  </Label>
                  <input
                    id="avatar_upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <p className="text-[11px] text-[#94A3B8] mt-1">PNG, JPG até 5MB</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nome" className="text-xs font-semibold text-[#1A2333]">
                  Nome Completo
                </Label>
                <Input
                  id="nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-[#1A2333]">
                  E-mail (Somente Leitura)
                </Label>
                <Input
                  id="email"
                  disabled
                  value={user?.email || ''}
                  className="h-10 text-xs rounded-xl border-[#E2E8F0] bg-slate-50 text-[#64748B]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#1A2333]">Escritório Ativo</Label>
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-xs border border-slate-100">
                  <Building2 className="h-4 w-4 text-[#0FA3A3]" />
                  <span className="font-semibold text-[#1A2333]">{tenant?.nome}</span>
                  {member && (
                    <Badge className="ml-auto bg-[#0FA3A3] text-white text-[10px] uppercase">
                      {member.perfil}
                    </Badge>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                disabled={savingProfile}
                className="w-full gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-10 shadow-xs"
              >
                {savingProfile ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Card 2: Preferências & Notificações */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#1A2333]">
              Notificações e E-mails
            </CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Configure como e quando deseja ser alertado sobre prazos
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="space-y-0.5 pr-2">
                <Label
                  htmlFor="email-notif-switch"
                  className="text-xs font-semibold text-[#1A2333] cursor-pointer"
                >
                  Receber e-mails de prazos
                </Label>
                <p className="text-[11px] text-[#64748B]">
                  Envio diário automático de obrigações a vencer (≤ 7 dias) e workflows atribuídos
                </p>
              </div>
              <Switch
                id="email-notif-switch"
                checked={emailNotifPrazo}
                onCheckedChange={handleToggleEmailNotif}
                disabled={savingPref}
              />
            </div>

            <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3 text-xs text-[#0FA3A3]">
              <p className="font-semibold">Lembretes Automáticos</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                O job agendado diário roda às 08h00 e gera notificações no sino da plataforma e
                e-mails transacionais para os responsáveis pelas guias fiscais.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Alterar Senha */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs md:col-span-2">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-[#1A2333]">Alterar Senha</CardTitle>
            <CardDescription className="text-xs text-[#64748B]">
              Atualize sua credencial de acesso ao sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSavePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="old_pass" className="text-xs font-semibold text-[#1A2333]">
                  Senha Atual
                </Label>
                <Input
                  id="old_pass"
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new_pass" className="text-xs font-semibold text-[#1A2333]">
                  Nova Senha (mínimo 8 caracteres)
                </Label>
                <Input
                  id="new_pass"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm_pass" className="text-xs font-semibold text-[#1A2333]">
                  Confirmar Nova Senha
                </Label>
                <Input
                  id="confirm_pass"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 text-xs rounded-xl border-[#E2E8F0]"
                />
              </div>

              <Button
                type="submit"
                disabled={savingPassword}
                className="w-full gap-2 rounded-xl bg-[#0B1F3A] hover:bg-[#123B6D] text-white font-semibold text-xs h-10 shadow-xs"
              >
                {savingPassword ? 'Alterando...' : 'Atualizar Senha'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

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
  FileBadge,
  Database,
  Trash2,
  HardDriveDownload,
  Wifi,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { RumoLogo, RumoIcon } from '@/components/RumoLogo'
import { usersService } from '@/services/users'
import { offlineDb } from '@/lib/offline/db'
import { useOnlineStatus } from '@/contexts/OnlineContext'
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

  // Dados do Escritório / Responsabilidade Técnica (NBC PP 01 / CFC)
  const [responsavelTecnico, setResponsavelTecnico] = useState(
    tenant?.responsavel_tecnico || 'Carlos Silva (Contador Responsável)',
  )
  const [crcResponsavel, setCrcResponsavel] = useState(
    tenant?.crc_responsavel || 'CRC/SP nº 2SP034821/O',
  )
  const [emailContato, setEmailContato] = useState(
    tenant?.email_contato || 'assessoria@rumoconsultoriacontabil.com.br',
  )
  const [enderecoCompleto, setEnderecoCompleto] = useState(
    tenant?.endereco_completo || 'Av. Paulista, 1578, Conjunto 802, Bela Vista - São Paulo / SP',
  )
  const [savingEscritorio, setSavingEscritorio] = useState(false)

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

  // Gerenciamento de Armazenamento Offline Local & Feature Toggle
  const {
    isOnline,
    isOfflineModeActive,
    pendingCount,
    refreshPendingCount,
    syncNow,
    toggleOfflineMode,
  } = useOnlineStatus()
  const [togglingOffline, setTogglingOffline] = useState(false)
  const [storageStats, setStorageStats] = useState<{ cacheCount: number; outboxCount: number }>({
    cacheCount: 0,
    outboxCount: 0,
  })
  const [clearingStorage, setClearingStorage] = useState(false)

  // Permissões: apenas Administrador e Contador podem alterar a chave de modo offline
  const canManageOfflineMode = member?.perfil === 'administrador' || member?.perfil === 'contador'

  const handleToggleOfflineSwitch = async (checked: boolean) => {
    if (!canManageOfflineMode) {
      toast({
        variant: 'destructive',
        title: 'Acesso Restrito',
        description:
          'Apenas Administradores e Contadores podem alterar a configuração de Modo Offline.',
      })
      return
    }

    // Se estiver DESLIGANDO e houver pendências não sincronizadas no dispositivo, exigir confirmação expressa
    if (!checked && pendingCount > 0) {
      const confirmed = window.confirm(
        `Atenção: Existem ${pendingCount} alteração(ões) pendente(s) gravada(s) localmente neste dispositivo.\n\n` +
          `Ao desativar o Modo Offline agora, as mutações pendentes locais serão descartadas e a plataforma passará a operar estritamente online.\n\n` +
          `Deseja realmente desativar e descartar as alterações não sincronizadas?`,
      )
      if (!confirmed) {
        return
      }
    }

    setTogglingOffline(true)
    try {
      const ok = await toggleOfflineMode(checked)
      if (ok) {
        await refreshAuth()
        const updatedStats = await offlineDb.getStorageStats()
        setStorageStats(updatedStats)
      }
    } finally {
      setTogglingOffline(false)
    }
  }

  React.useEffect(() => {
    offlineDb
      .getStorageStats()
      .then(setStorageStats)
      .catch(() => {})
  }, [pendingCount])

  const handleClearLocalData = async () => {
    if (pendingCount > 0) {
      const confirmClear = window.confirm(
        `Atenção: Você possui ${pendingCount} alteração(ões) pendente(s) de sincronização neste dispositivo. Se limpar os dados agora, essas alterações locais não sincronizadas serão perdidas.\n\nDeseja prosseguir mesmo assim?`,
      )
      if (!confirmClear) return
    }

    setClearingStorage(true)
    try {
      const res = await offlineDb.clearLocalData()
      await refreshPendingCount()
      const updatedStats = await offlineDb.getStorageStats()
      setStorageStats(updatedStats)
      toast({
        title: 'Dados locais limpos com sucesso',
        description: `${res.cachesCleared} registros do cache local removidos deste dispositivo. Os dados salvos no servidor remoto não foram afetados.`,
      })
    } catch (err) {
      console.error('Erro ao limpar dados locais:', err)
      toast({
        variant: 'destructive',
        title: 'Falha ao limpar armazenamento',
        description: 'Não foi possível limpar os dados locais do navegador.',
      })
    } finally {
      setClearingStorage(false)
    }
  }

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

        {/* Card: Identidade Visual & Marca do Escritório */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-[#0FA3A3]" />
                <span>Identidade Visual & Marca Oficial</span>
              </CardTitle>
              <Badge className="bg-teal-100 text-teal-800 text-[10px] font-bold">Oficial</Badge>
            </div>
            <CardDescription className="text-xs text-[#64748B]">
              Símbolo geométrico navy oficial aplicado em relatórios, login, sidebar, contratos e
              favicon.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#002244] text-white shadow-md ring-2 ring-[#002244]/20 shrink-0">
                <RumoIcon size={46} color="#FFFFFF" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-[#1A2333]">
                    {tenant?.nome || 'Rumo Consultoria'}
                  </h4>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono text-[#002244] border-[#002244]/40"
                  >
                    #002244
                  </Badge>
                </div>
                <p className="text-xs text-[#64748B]">
                  Marca ativa com emblema geométrico circular em azul-marinho escuro e vetor
                  simétrico em notch ascensional.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />
                    Sincronizada em toda a plataforma
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                  Prévia em Fundo Claro
                </span>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-2">
                  <RumoLogo size={32} variant="light" title="Rumo" subtitle="Contabilidade" />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                  Prévia em Fundo Escuro
                </span>
                <div className="p-2 rounded-lg bg-[#0B1F3A] flex items-center gap-2">
                  <RumoLogo size={32} variant="dark" title="Rumo" subtitle="Contabilidade" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card: Responsável Técnico Contábil e CRC (NBC PP 01 / CFC) */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-1.5">
                <FileBadge className="h-4 w-4 text-[#0FA3A3]" />
                <span>Responsabilidade Técnica (CFC / NBC PP 01)</span>
              </CardTitle>
              <Badge className="bg-blue-100 text-blue-800 text-[10px] font-bold">NBC PP 01</Badge>
            </div>
            <CardDescription className="text-xs text-[#64748B]">
              Nome do contabilista e registro CRC exibidos em todos os demonstrativos oficiais,
              pareceres e contratos.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!tenant?.id) return
                setSavingEscritorio(true)
                try {
                  await pb.collection('tenants').update(tenant.id, {
                    responsavel_tecnico: responsavelTecnico.trim(),
                    crc_responsavel: crcResponsavel.trim(),
                    email_contato: emailContato.trim(),
                    endereco_completo: enderecoCompleto.trim(),
                  })
                  await refreshAuth()
                  toast({
                    title: 'Dados técnicos atualizados!',
                    description: 'O CRC e responsável técnico foram salvos com sucesso.',
                  })
                } catch (err) {
                  toast({
                    variant: 'destructive',
                    title: 'Erro ao salvar dados técnicos',
                    description: 'Falha ao atualizar informações do escritório.',
                  })
                } finally {
                  setSavingEscritorio(false)
                }
              }}
              className="space-y-3.5"
            >
              <div className="space-y-1">
                <Label htmlFor="resp_tec" className="text-xs font-semibold text-[#1A2333]">
                  Contador Responsável Técnico
                </Label>
                <Input
                  id="resp_tec"
                  value={responsavelTecnico}
                  onChange={(e) => setResponsavelTecnico(e.target.value)}
                  placeholder="Nome completo do Contador"
                  className="h-9 text-xs rounded-xl border-[#E2E8F0]"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="crc_field" className="text-xs font-semibold text-[#1A2333]">
                  Registro no Conselho Regional de Contabilidade (CRC)
                </Label>
                <Input
                  id="crc_field"
                  value={crcResponsavel}
                  onChange={(e) => setCrcResponsavel(e.target.value)}
                  placeholder="Ex: CRC/SP nº 2SP034821/O"
                  className="h-9 text-xs rounded-xl border-[#E2E8F0] font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="email_cont" className="text-xs font-semibold text-[#1A2333]">
                    E-mail do Escritório
                  </Label>
                  <Input
                    id="email_cont"
                    type="email"
                    value={emailContato}
                    onChange={(e) => setEmailContato(e.target.value)}
                    placeholder="assessoria@escritorio.com.br"
                    className="h-9 text-xs rounded-xl border-[#E2E8F0]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="end_cont" className="text-xs font-semibold text-[#1A2333]">
                    Endereço Completo
                  </Label>
                  <Input
                    id="end_cont"
                    value={enderecoCompleto}
                    onChange={(e) => setEnderecoCompleto(e.target.value)}
                    placeholder="Av. Paulista, 1578..."
                    className="h-9 text-xs rounded-xl border-[#E2E8F0]"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={savingEscritorio}
                className="w-full gap-2 rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold text-xs h-9 shadow-xs"
              >
                {savingEscritorio ? 'Salvando...' : 'Salvar Responsável Técnico & CRC'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Card: Armazenamento e Persistência Offline */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-[#1A2333] flex items-center gap-1.5">
                <Database className="h-4 w-4 text-[#0FA3A3]" />
                <span>Armazenamento Local & Modo Offline</span>
              </CardTitle>
              <div className="flex items-center gap-1.5">
                {/* Badge de status do Modo Offline */}
                <Badge
                  className={
                    isOfflineModeActive
                      ? 'bg-teal-100 text-teal-800 text-[10px] font-bold'
                      : 'bg-slate-100 text-slate-700 text-[10px] font-bold'
                  }
                >
                  {isOfflineModeActive ? 'OFFLINE ATIVO' : 'Somente online'}
                </Badge>
                {/* Badge de conexão de rede */}
                <Badge
                  className={
                    isOnline
                      ? 'bg-emerald-100 text-emerald-800 text-[10px] font-bold gap-1'
                      : 'bg-amber-100 text-amber-800 text-[10px] font-bold gap-1'
                  }
                >
                  <Wifi className="h-3 w-3" />
                  <span>{isOnline ? 'Online' : 'Offline'}</span>
                </Badge>
              </div>
            </div>
            <CardDescription className="text-xs text-[#64748B]">
              Gerencie a persistência de registros em cache no navegador e o comportamento offline
              deste escritório.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Interruptor (Toggle) do Modo Offline solicitado pelo usuário */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex items-center justify-between gap-3">
              <div className="space-y-1 pr-2">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="offline-mode-switch"
                    className="text-xs font-bold text-[#1A2333] cursor-pointer"
                  >
                    Modo offline
                  </Label>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {isOfflineModeActive ? 'Ligado' : 'Desligado'}
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B]">
                  Salva suas alterações no dispositivo quando a internet cai e sincroniza
                  automaticamente ao reconectar.
                </p>
                {!canManageOfflineMode && (
                  <p className="text-[10px] text-amber-700 font-medium">
                    * Apenas Administrador e Contador podem alterar esta chave.
                  </p>
                )}
              </div>
              <Switch
                id="offline-mode-switch"
                checked={isOfflineModeActive}
                onCheckedChange={handleToggleOfflineSwitch}
                disabled={togglingOffline || !canManageOfflineMode}
              />
            </div>

            {/* Painel Informativo sobre o Estado Atual */}
            {!isOfflineModeActive ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-[#64748B] space-y-1">
                <p className="font-semibold text-slate-700">
                  Modo offline desativado — nenhum dado salvo neste dispositivo
                </p>
                <p className="text-[11px]">
                  A plataforma opera com conexão direta ao servidor. Em caso de queda de sinal, as
                  gravações serão bloqueadas honestamente e você será informado para recarregar
                  assim que a internet retornar.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[#0FA3A3]">
                  <HardDriveDownload className="h-3.5 w-3.5" />
                  <span>Cache e Outbox Ativos</span>
                </div>
                <p className="text-[11px] text-[#64748B]">
                  Empresas, Documentos, Obrigações, DP e Financeiro realizam cache no IndexedDB
                  deste navegador e enfileiram mutações caso ocorra queda de conexão.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                <p className="text-lg font-bold text-[#1A2333]">{storageStats.cacheCount}</p>
                <p className="text-[11px] text-[#64748B]">Registros em Cache Local</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                <p className="text-lg font-bold text-[#0FA3A3]">{storageStats.outboxCount}</p>
                <p className="text-[11px] text-[#64748B]">Mutações Pendentes</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              {isOnline && storageStats.outboxCount > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => syncNow()}
                  className="rounded-xl border-teal-200 text-[#0FA3A3] hover:bg-teal-50 text-xs h-9"
                >
                  Sincronizar Fila Agora
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearLocalData}
                disabled={
                  clearingStorage ||
                  (storageStats.cacheCount === 0 && storageStats.outboxCount === 0)
                }
                className="ml-auto rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs h-9 gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{clearingStorage ? 'Limpando...' : 'Limpar dados deste dispositivo'}</span>
              </Button>
            </div>
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

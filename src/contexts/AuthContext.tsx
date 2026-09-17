import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import type { User, Tenant, TenantMember, UserRole } from '@/types'
import { setOfflineModeLocalState } from '@/lib/offline/offlineControl'

interface AuthContextType {
  user: User | null
  tenant: Tenant | null
  tenants: Tenant[]
  member: TenantMember | null
  loading: boolean
  signIn: (email: string, pass: string) => Promise<void>
  signUp: (data: { nome: string; email: string; pass: string; escritorio: string }) => Promise<void>
  signOut: () => void
  switchTenant: (tenant: Tenant) => void
  hasPermission: (allowedRoles: UserRole[]) => boolean
  isCliente: boolean
  isGestorEmpresas: boolean
  refreshAuth: () => Promise<void>
  createEscritorio: (nome: string, cnpj?: string) => Promise<Tenant>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(pb.authStore.record as unknown as User | null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [member, setMember] = useState<TenantMember | null>(null)
  const [loading, setLoading] = useState(true)

  const loadTenantData = useCallback(async (currentUserId: string) => {
    try {
      // Find tenant memberships
      const members = await pb.collection('tenant_members').getFullList<TenantMember>({
        filter: `user_id = "${currentUserId}" && status = "ativo"`,
        expand: 'tenant_id',
      })

      const availableTenants = members
        .map((m) => m.expand?.tenant_id)
        .filter((t): t is Tenant => Boolean(t))

      setTenants(availableTenants)

      // Saved tenant in localStorage or pick the first
      const savedTenantId = localStorage.getItem('rumo_current_tenant_id')
      // Prefer previously saved tenant, or first tenant where user is admin/contador, or first available
      let activeTenant = availableTenants.find((t) => t.id === savedTenantId)
      if (!activeTenant) {
        const adminMembership = members.find(
          (m) => m.perfil === 'administrador' || m.perfil === 'contador',
        )
        if (adminMembership && adminMembership.expand?.tenant_id) {
          activeTenant = adminMembership.expand.tenant_id
        } else {
          activeTenant = availableTenants[0]
        }
      }

      if (!activeTenant && availableTenants.length === 0) {
        // Fallback: check if any tenant exists in db to associate
        const allTenants = await pb.collection('tenants').getFullList<Tenant>({ limit: 1 })
        if (allTenants.length > 0) {
          activeTenant = allTenants[0]
          // auto create member
          try {
            const newMem = await pb.collection('tenant_members').create<TenantMember>({
              user_id: currentUserId,
              tenant_id: activeTenant.id,
              perfil: 'administrador',
              status: 'ativo',
            })
            setMember(newMem)
          } catch {
            /* intentionally ignored */
          }
        }
      }

      if (activeTenant) {
        setTenant(activeTenant)
        localStorage.setItem('rumo_current_tenant_id', activeTenant.id)
        setOfflineModeLocalState(activeTenant.id, Boolean(activeTenant.modo_offline))
        let currentMember = members.find((m) => m.tenant_id === activeTenant.id)
        // If currentMember is not found or has lower profile, check if user is admin on any tenant or fetch fresh
        if (!currentMember) {
          try {
            const freshMembers = await pb.collection('tenant_members').getFullList<TenantMember>({
              filter: `user_id = "${currentUserId}" && tenant_id = "${activeTenant.id}"`,
              limit: 1,
            })
            if (freshMembers.length > 0) {
              currentMember = freshMembers[0]
            }
          } catch {
            /* intentionally ignored */
          }
        }
        if (currentMember) {
          setMember(currentMember)
        } else if (members.length > 0) {
          // Fallback to highest profile member available
          const bestMember =
            members.find((m) => m.perfil === 'administrador') ||
            members.find((m) => m.perfil === 'contador') ||
            members[0]
          setMember(bestMember)
        }
      }
    } catch (err) {
      console.error('Error loading tenant data:', err)
    }
  }, [])

  const refreshAuth = useCallback(async () => {
    if (pb.authStore.isValid && pb.authStore.record) {
      try {
        const refreshedUser = await pb.collection('users').getOne<User>(pb.authStore.record.id)
        setUser(refreshedUser)
        await loadTenantData(refreshedUser.id)
      } catch (err) {
        console.error('Refresh auth failed:', err)
        setUser(pb.authStore.record as unknown as User)
      }
    } else {
      setUser(null)
      setTenant(null)
      setTenants([])
      setMember(null)
    }
    setLoading(false)
  }, [loadTenantData])

  useEffect(() => {
    refreshAuth()

    const unsubscribe = pb.authStore.onChange(() => {
      refreshAuth()
    })

    return () => {
      unsubscribe()
    }
  }, [refreshAuth])

  const signIn = async (email: string, pass: string) => {
    const authData = await pb.collection('users').authWithPassword(email, pass)
    setUser(authData.record as unknown as User)
    await loadTenantData(authData.record.id)
  }

  const signUp = async (data: {
    nome: string
    email: string
    pass: string
    escritorio: string
  }) => {
    // 1. Create user
    const newUser = await pb.collection('users').create<User>({
      email: data.email,
      password: data.pass,
      passwordConfirm: data.pass,
      name: data.nome,
    })

    // 2. Create tenant
    const newTenant = await pb.collection('tenants').create<Tenant>({
      nome: data.escritorio || `${data.nome} Contabilidade`,
      plano: 'starter',
      ativo: true,
    })

    // 3. Link as owner/administrador
    await pb.collection('tenant_members').create<TenantMember>({
      user_id: newUser.id,
      tenant_id: newTenant.id,
      perfil: 'administrador',
      status: 'ativo',
    })

    // 4. Auto login
    await signIn(data.email, data.pass)
  }

  const createEscritorio = async (nome: string, cnpj?: string): Promise<Tenant> => {
    if (!user) throw new Error('Usuário não autenticado.')
    const newTenant = await pb.collection('tenants').create<Tenant>({
      nome: nome.trim(),
      cnpj: cnpj?.trim() || '',
      plano: 'starter',
      ativo: true,
      onboarding_checklist: {
        escritorio_dados: true,
        primeira_empresa: false,
        plano_contas: false,
        primeiro_usuario: false,
        convite_portal: false,
        ignorado: false,
      },
    })

    const newMember = await pb.collection('tenant_members').create<TenantMember>({
      user_id: user.id,
      tenant_id: newTenant.id,
      perfil: 'administrador',
      status: 'ativo',
    })

    setTenants((prev) => [...prev, newTenant])
    setTenant(newTenant)
    setMember(newMember)
    localStorage.setItem('rumo_current_tenant_id', newTenant.id)
    setOfflineModeLocalState(newTenant.id, Boolean(newTenant.modo_offline))

    return newTenant
  }

  const signOut = () => {
    pb.authStore.clear()
    setUser(null)
    setTenant(null)
    setTenants([])
    setMember(null)
    localStorage.removeItem('rumo_current_tenant_id')
  }

  const switchTenant = (t: Tenant) => {
    setTenant(t)
    localStorage.setItem('rumo_current_tenant_id', t.id)
    setOfflineModeLocalState(t.id, Boolean(t.modo_offline))
    if (user) {
      pb.collection('tenant_members')
        .getFullList<TenantMember>({
          filter: `user_id = "${user.id}" && tenant_id = "${t.id}"`,
          limit: 1,
        })
        .then((res) => {
          if (res.length > 0) setMember(res[0])
        })
        .catch(() => {})
    }
  }

  const hasPermission = (allowedRoles: UserRole[]) => {
    // Check current tenant member profile
    if (member?.perfil && allowedRoles.includes(member.perfil)) {
      return true
    }
    // Check if user has required role in any of their tenant memberships
    // (e.g. if tenant switcher picked another tenant, or initial load)
    return false
  }

  const isCliente = member?.perfil === 'cliente'

  // Auxiliar robusto para perfil administrativo/contábil (Administrador ou Contador)
  const isGestorEmpresas = Boolean(
    member?.perfil === 'administrador' ||
    member?.perfil === 'contador' ||
    (user?.role as string) === 'administrador' ||
    (user?.role as string) === 'contador' ||
    (user?.perfil as string) === 'administrador' ||
    (user?.perfil as string) === 'contador',
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        tenants,
        member,
        loading,
        signIn,
        signUp,
        signOut,
        switchTenant,
        hasPermission,
        isCliente,
        isGestorEmpresas,
        refreshAuth,
        createEscritorio,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

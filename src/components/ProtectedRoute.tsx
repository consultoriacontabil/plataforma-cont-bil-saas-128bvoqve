import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isCliente } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F6F7F9]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#0FA3A3]" />
          <p className="text-sm font-medium text-[#64748B]">Carregando Rumo Contábil...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Se o usuário logado for perfil 'cliente', direcionar para tela do /portal
  if (isCliente && !location.pathname.startsWith('/portal')) {
    return <Navigate to="/portal" replace />
  }

  return <>{children}</>
}

import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Compass,
  Mail,
  Lock,
  User,
  Building,
  AlertCircle,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

export default function SignUp() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [escritorio, setEscritorio] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (password.length < 8) {
      setErrorMsg('A senha deve possuir no mínimo 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('As senhas informadas não conferem.')
      return
    }

    setLoading(true)

    try {
      await signUp({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        escritorio: escritorio.trim(),
        pass: password,
      })

      toast({
        title: 'Bem-vindo(a) à Rumo!',
        description: 'Seu escritório contábil foi criado com sucesso. Vamos ao onboarding!',
      })
      navigate('/dashboard', { replace: true, state: { showOnboarding: true } })
    } catch (err: unknown) {
      console.error('Sign up error:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao criar conta. Tente novamente.'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-[#F6F7F9]">
      {/* Left Panel (55% desktop) */}
      <div className="relative flex min-h-[380px] w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0B1F3A] via-[#0E284B] to-[#123B6D] p-8 lg:min-h-screen lg:w-[55%] lg:p-16">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0FA3A3] to-teal-400 text-white shadow-lg">
            <Compass className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Rumo</h1>
            <p className="text-xs uppercase tracking-widest text-[#94A3B8]">Consultoria Contábil</p>
          </div>
        </div>

        <div className="relative z-10 my-10 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-[#0FA3A3] mb-4">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Cadastro Rápido de Escritório</span>
          </div>
          <h2 className="text-3xl font-extrabold leading-tight text-white md:text-5xl">
            Modernize o atendimento contábil do seu time
          </h2>
          <p className="mt-4 text-base text-[#94A3B8] md:text-lg">
            Tenha em minutos um tenant exclusivo com isolamento seguro, trilha de auditoria e
            assistente inteligente.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="animate-float rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <p className="text-2xl font-bold text-white">Multi-tenant</p>
            <p className="text-xs text-[#94A3B8]">Segurança lógica ponta a ponta</p>
          </div>
          <div
            className="animate-float rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"
            style={{ animationDelay: '1.5s' }}
          >
            <p className="text-2xl font-bold text-[#0FA3A3]">RBAC Nativo</p>
            <p className="text-xs text-[#94A3B8]">Perfis com controle de acesso</p>
          </div>
          <div
            className="animate-float rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"
            style={{ animationDelay: '3s' }}
          >
            <p className="text-2xl font-bold text-emerald-400">Rumo Agent</p>
            <p className="text-xs text-[#94A3B8]">Assistente contábil nativo</p>
          </div>
        </div>
      </div>

      {/* Right Panel (45% desktop) */}
      <div className="flex flex-1 items-center justify-center p-6 md:p-12 lg:w-[45%]">
        <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-xl">
          <div className="mb-6">
            <h3 className="text-2xl font-bold tracking-tight text-[#1A2333]">
              Criar seu escritório
            </h3>
            <p className="mt-1 text-sm text-[#64748B]">
              Cadastre seu usuário administrador e configure sua organização.
            </p>
          </div>

          {errorMsg && (
            <div className="animate-shake mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-[#EF4444]">
              <AlertCircle className="h-5 w-5 shrink-0 text-[#EF4444]" />
              <div className="space-y-0.5">
                <p className="font-semibold text-red-900">Erro no cadastro</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-xs font-semibold text-[#1A2333]">
                Nome completo
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  id="nome"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  className="h-11 pl-10 rounded-xl border-[#E2E8F0] focus:border-[#0FA3A3]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="escritorio" className="text-xs font-semibold text-[#1A2333]">
                Nome do escritório contábil
              </Label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  id="escritorio"
                  required
                  value={escritorio}
                  onChange={(e) => setEscritorio(e.target.value)}
                  placeholder="Ex: Rumo Contabilidade & Consultoria"
                  className="h-11 pl-10 rounded-xl border-[#E2E8F0] focus:border-[#0FA3A3]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-email" className="text-xs font-semibold text-[#1A2333]">
                E-mail corporativo
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  id="signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@seu-escritorio.com.br"
                  className="h-11 pl-10 rounded-xl border-[#E2E8F0] focus:border-[#0FA3A3]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-pass" className="text-xs font-semibold text-[#1A2333]">
                Senha (mínimo 8 caracteres)
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  id="signup-pass"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 pl-10 rounded-xl border-[#E2E8F0] focus:border-[#0FA3A3]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-confirm" className="text-xs font-semibold text-[#1A2333]">
                Confirmar senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  id="signup-confirm"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 pl-10 rounded-xl border-[#E2E8F0] focus:border-[#0FA3A3]"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full rounded-xl bg-[#0FA3A3] hover:bg-[#0C8585] text-white font-semibold transition-all hover:scale-[1.01]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Configurando escritório...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>Criar conta e acessar</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-[#E2E8F0] pt-6 text-center text-xs text-[#64748B]">
            <span>Já possui conta? </span>
            <Link
              to="/login"
              className="font-semibold text-[#0FA3A3] hover:underline hover:text-[#0C8585]"
            >
              Fazer login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

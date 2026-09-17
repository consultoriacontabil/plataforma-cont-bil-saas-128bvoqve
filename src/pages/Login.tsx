import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, AlertCircle, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { RumoLogo } from '@/components/RumoLogo'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  const [email, setEmail] = useState('rumo@rumoconsultoriacontabil.com.br')
  const [password, setPassword] = useState('Skip@Pass')
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try {
      await signIn(email.trim(), password)
      toast({
        title: 'Bem-vindo(a) à Rumo Contábil!',
        description: 'Login efetuado com sucesso.',
      })
      const dest =
        (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard'
      navigate(dest, { replace: true })
    } catch (err: unknown) {
      console.error('Login error:', err)
      const message =
        err instanceof Error ? err.message : 'Credenciais inválidas. Verifique seu e-mail e senha.'
      setErrorMsg(message)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({
        variant: 'destructive',
        title: 'Informe seu e-mail',
        description: 'Digite o e-mail cadastrado para enviarmos as instruções de redefinição.',
      })
      return
    }

    try {
      await pb.collection('users').requestPasswordReset(email.trim())
      setResetSent(true)
      toast({
        title: 'Instruções enviadas',
        description: `Se o e-mail ${email} estiver cadastrado, você receberá o link de redefinição em instantes.`,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao solicitar redefinição',
        description: 'Não foi possível enviar o e-mail no momento. Tente novamente mais tarde.',
      })
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-[#F6F7F9]">
      {/* Left Panel (55% desktop) - Deep Navy Gradient & Floating Chips */}
      <div className="relative flex min-h-[380px] w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0B1F3A] via-[#0E284B] to-[#123B6D] p-8 lg:min-h-screen lg:w-[55%] lg:p-16">
        {/* Subtle grid background overlay */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Top Logo */}
        <div className="relative z-10">
          <RumoLogo
            size={48}
            variant="dark"
            badgeStyle="teal"
            title="Rumo"
            subtitle="Consultoria Contábil"
          />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 my-10 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-[#0FA3A3] mb-4">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Plataforma Contábil SaaS v0.1.0</span>
          </div>
          <h2 className="text-3xl font-extrabold leading-tight text-white md:text-5xl">
            Gestão contábil completa para o seu escritório
          </h2>
          <p className="mt-4 text-base text-[#94A3B8] md:text-lg">
            Unifique empresas, GED inteligente, kanban de workflows e controle fiscal com suporte do
            Rumo Agent nativo.
          </p>
        </div>

        {/* Floating Stat Chips */}
        <div className="relative z-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="animate-float rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition-all">
            <p className="text-2xl font-bold text-white">100%</p>
            <p className="text-xs text-[#94A3B8]">Empresas gerenciadas em isolamento</p>
          </div>

          <div
            className="animate-float rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition-all"
            style={{ animationDelay: '1.5s' }}
          >
            <p className="text-2xl font-bold text-[#0FA3A3]">GED 25MB</p>
            <p className="text-xs text-[#94A3B8]">Documentos processados com auditoria</p>
          </div>

          <div
            className="animate-float rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition-all"
            style={{ animationDelay: '3s' }}
          >
            <p className="text-2xl font-bold text-emerald-400">Rumo AI</p>
            <p className="text-xs text-[#94A3B8]">Workflows concluídos com inteligência</p>
          </div>
        </div>
      </div>

      {/* Right Panel (45% desktop) - White Card & Login Form */}
      <div className="flex flex-1 items-center justify-center p-6 md:p-12 lg:w-[45%]">
        <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-xl">
          <div className="mb-6">
            <h3 className="text-2xl font-bold tracking-tight text-[#1A2333]">
              Entrar na plataforma
            </h3>
            <p className="mt-1 text-sm text-[#64748B]">
              Acesse sua conta para gerenciar clientes e rotinas fiscais.
            </p>
          </div>

          {errorMsg && (
            <div className="animate-shake mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-[#EF4444]">
              <AlertCircle className="h-5 w-5 shrink-0 text-[#EF4444]" />
              <div className="space-y-0.5">
                <p className="font-semibold text-red-900">Erro de autenticação</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {resetSent && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Link de recuperação encaminhado para a sua caixa de entrada.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-[#1A2333]">
                E-mail profissional
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@rumoconsultoria.com.br"
                  className="h-11 pl-10 rounded-xl border-[#E2E8F0] focus:border-[#0FA3A3]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-[#1A2333]">
                  Senha de acesso
                </Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-[#0FA3A3] hover:underline hover:text-[#0C8585]"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 pl-10 rounded-xl border-[#E2E8F0] focus:border-[#0FA3A3]"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
              />
              <label
                htmlFor="remember"
                className="text-xs font-medium text-[#64748B] cursor-pointer"
              >
                Lembrar de mim neste dispositivo
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full rounded-xl bg-[#0B1F3A] hover:bg-[#123B6D] text-white font-semibold transition-all hover:scale-[1.01]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Validando credenciais...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>Entrar no sistema</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-[#E2E8F0] pt-6 text-center text-xs text-[#64748B]">
            <span>Não tem conta? </span>
            <Link
              to="/signup"
              className="font-semibold text-[#0FA3A3] hover:underline hover:text-[#0C8585]"
            >
              Solicite acesso ao seu escritório
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Compass,
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  User,
  Fingerprint,
  FileText,
  Copy,
  Check,
  ExternalLink,
  Lock,
} from 'lucide-react'
import { assinaturasService } from '@/services/assinaturas'
import type { AssinaturaDemonstrativoRecord, DemonstrativoRecord } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatDatePtBr, formatDateTimePtBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'

export default function VerificarAssinaturaPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialToken = searchParams.get('token') || ''

  const [tokenInput, setTokenInput] = useState(initialToken)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [copied, setCopied] = useState(false)

  const [resultado, setResultado] = useState<{
    assinatura: AssinaturaDemonstrativoRecord
    demonstrativo: DemonstrativoRecord | null
    integridadeOk: boolean
    hashAtualCalculado: string
  } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const { toast } = useToast()

  const handleBuscar = async (tokenParaBuscar?: string) => {
    const token = (tokenParaBuscar !== undefined ? tokenParaBuscar : tokenInput).trim()
    if (!token) {
      toast({
        variant: 'destructive',
        title: 'Token não informado',
        description: 'Digite o código de verificação para consultar a autenticidade.',
      })
      return
    }

    setLoading(true)
    setErrorMsg('')
    setHasSearched(true)
    setResultado(null)

    // Atualiza a URL com o token pesquisado
    setSearchParams({ token })

    try {
      const res = await assinaturasService.getByToken(token)
      setResultado(res)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Assinatura não localizada no sistema.'
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialToken) {
      handleBuscar(initialToken)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast({
      title: 'Copiado!',
      description: 'Código copiado para a área de transferência.',
    })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#1A2333] flex flex-col justify-between">
      {/* Topbar Público */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#E2E8F0] bg-white px-4 md:px-8 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0FA3A3] to-[#123B6D] text-white shadow-md">
            <Compass className="h-6 w-6" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-[#1A2333]">
              Verificador de Autenticidade Contábil
            </span>
            <p className="text-[10px] uppercase font-semibold text-[#64748B]">
              Rumo Consultoria Contábil • Plataforma de Assinatura Digital
            </p>
          </div>
        </div>

        <div>
          <Link to="/login">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-semibold h-9 border-[#E2E8F0] text-[#123B6D]"
            >
              Acessar Plataforma
            </Button>
          </Link>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Banner de Explicação */}
        <div className="text-center space-y-2 py-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-[#0FA3A3] text-xs font-bold">
            <ShieldCheck className="h-4 w-4" />
            <span>Validação Pública e Registro de Integridade Criptográfica</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A2333]">
            Consulta Pública de Assinatura & Integridade
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] max-w-2xl mx-auto">
            Qualquer pessoa, instituição financeira ou órgão fiscalizador pode verificar a validade,
            autoria e integridade de demonstrações contábeis emitidas pela Rumo Consultoria Contábil
            através do token exclusivo impresso no documento.
          </p>
        </div>

        {/* Caixa de Busca de Token */}
        <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
          <CardContent className="p-4 sm:p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleBuscar()
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#94A3B8]" />
                <Input
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Informe o token (ex: RUMO-202609-29JIOW46)"
                  className="pl-10 h-11 rounded-xl text-xs font-mono border-[#E2E8F0] uppercase"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="h-11 rounded-xl px-6 font-semibold text-xs bg-[#0FA3A3] hover:bg-[#0C8585] text-white shadow-xs"
              >
                {loading ? 'Consultando...' : 'Verificar Autenticidade'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Mensagem de Erro */}
        {hasSearched && errorMsg && (
          <Card className="rounded-2xl border-rose-200 bg-rose-50/70 shadow-2xs animate-fade-in">
            <CardContent className="p-6 flex items-start gap-3">
              <ShieldAlert className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-rose-900">
                  Documento ou Assinatura Não Encontrados
                </h3>
                <p className="text-xs text-rose-700 mt-1">
                  {errorMsg} Verifique se o código foi digitado corretamente, respeitando hifens e
                  letras maiúsculas.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resultado Encontrado */}
        {resultado && (
          <div className="space-y-6 animate-fade-in">
            {/* Card de Status de Integridade */}
            <Card
              className={`rounded-2xl border ${
                resultado.assinatura.status === 'assinada' && resultado.integridadeOk
                  ? 'border-emerald-300 bg-emerald-50/60'
                  : resultado.assinatura.status === 'solicitada'
                    ? 'border-blue-300 bg-blue-50/60'
                    : 'border-amber-300 bg-amber-50/60'
              } shadow-2xs`}
            >
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {resultado.assinatura.status === 'assinada' && resultado.integridadeOk ? (
                      <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
                        <CheckCircle2 className="h-7 w-7" />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
                        <Lock className="h-7 w-7" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-[#1A2333]">
                          {resultado.assinatura.status === 'assinada'
                            ? 'Documento Autêntico e Assinado'
                            : 'Assinatura em Andamento (Solicitada)'}
                        </h2>
                        <Badge
                          className={`text-xs font-bold px-2.5 py-0.5 ${
                            resultado.assinatura.status === 'assinada'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {resultado.assinatura.status === 'assinada'
                            ? 'Assinatura Válida'
                            : 'Aguardando Assinante'}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#64748B] mt-1">
                        Token Oficial:{' '}
                        <span className="font-mono font-bold">
                          {resultado.assinatura.token_verificacao}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                      Status de Integridade SHA-256
                    </span>
                    {resultado.integridadeOk ? (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        100% Íntegro (Sem Alterações)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Validação Pendente / Divergente
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detalhes do Demonstrativo & Assinatura */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Dados do Documento */}
              <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
                <CardHeader className="p-5 pb-3 border-b border-[#E2E8F0] bg-slate-50/50">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#0FA3A3]" />
                    <span>Demonstrativo Contábil</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-3 text-xs">
                  <div>
                    <span className="text-[#64748B] block text-[11px]">Tipo de Documento</span>
                    <span className="font-bold text-[#1A2333] text-sm">
                      {resultado.demonstrativo?.tipo === 'dre'
                        ? 'DRE — Demonstração do Resultado do Exercício'
                        : resultado.demonstrativo?.tipo === 'balanco'
                          ? 'Balanço Patrimonial Estruturado'
                          : 'Demonstrativo Contábil Oficial'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#64748B] block text-[11px]">
                      Competência de Apuração
                    </span>
                    <span className="font-mono font-bold text-[#1A2333]">
                      {resultado.assinatura.competencia}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#64748B] block text-[11px]">Empresa Titular</span>
                    <span className="font-semibold text-[#1A2333]">
                      {resultado.demonstrativo?.expand?.empresa?.razao_social ||
                        resultado.demonstrativo?.expand?.empresa?.nome_fantasia ||
                        'Empresa Registrada'}
                    </span>
                    {resultado.demonstrativo?.expand?.empresa?.cnpj && (
                      <span className="block text-[11px] font-mono text-[#64748B]">
                        CNPJ: {resultado.demonstrativo.expand.empresa.cnpj}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[#64748B] block text-[11px]">Escritório Emissor</span>
                    <span className="font-medium text-[#1A2333]">
                      Rumo Consultoria Contábil • CRC/SP 2SP034821/O
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Dados da Assinatura Digital */}
              <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
                <CardHeader className="p-5 pb-3 border-b border-[#E2E8F0] bg-slate-50/50">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-2">
                    <User className="h-4 w-4 text-[#0FA3A3]" />
                    <span>Dados do Assinante & Registro</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-3 text-xs">
                  <div>
                    <span className="text-[#64748B] block text-[11px]">Nome do Assinante</span>
                    <span className="font-bold text-[#1A2333] text-sm">
                      {resultado.assinatura.assinante}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#64748B] block text-[11px]">Qualificação / CPF</span>
                    <span className="font-medium text-[#1A2333]">
                      {resultado.assinatura.cargo_cpf}
                    </span>
                  </div>

                  <div>
                    <span className="text-[#64748B] block text-[11px]">Tipo de Assinatura</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant="outline"
                        className="text-[11px] font-bold border-teal-300 text-teal-800 bg-teal-50"
                      >
                        {resultado.assinatura.tipo_assinatura === 'icp_brasil'
                          ? 'ICP-Brasil (Certificado Digital)'
                          : 'Eletrônica Declarada (SHA-256 + IP)'}
                      </Badge>
                      <span className="text-[10px] text-[#64748B]">
                        Provedor: {resultado.assinatura.provedor.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[#64748B] block text-[11px]">
                      Data e Hora da Assinatura
                    </span>
                    <span className="font-medium text-[#1A2333]">
                      {resultado.assinatura.data_assinatura
                        ? formatDateTimePtBr(resultado.assinatura.data_assinatura)
                        : resultado.assinatura.data_solicitacao
                          ? `Solicitada em ${formatDateTimePtBr(resultado.assinatura.data_solicitacao)}`
                          : 'Data gravada'}
                    </span>
                  </div>

                  {resultado.assinatura.ip_assinatura && (
                    <div>
                      <span className="text-[#64748B] block text-[11px]">
                        Origem / IP Registrado
                      </span>
                      <span className="font-mono text-[11px] text-[#64748B]">
                        {resultado.assinatura.ip_assinatura}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Card 3: Auditoria Criptográfica & Hash SHA-256 */}
            <Card className="rounded-2xl border-[#E2E8F0] shadow-2xs">
              <CardHeader className="p-5 pb-3 border-b border-[#E2E8F0] bg-slate-50/50">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-2">
                  <Fingerprint className="h-4 w-4 text-[#0FA3A3]" />
                  <span>Integridade Criptográfica (Hash SHA-256)</span>
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
                  Resumo criptográfico gerado a partir do conteúdo imutável do demonstrativo
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#1A2333]">
                      Hash Registrado no Momento da Assinatura:
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(resultado.assinatura.hash_conteudo)}
                      className="h-6 px-2 text-[10px] text-[#0FA3A3] gap-1"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copied ? 'Copiado' : 'Copiar Hash'}</span>
                    </Button>
                  </div>
                  <div className="p-3 bg-slate-100 rounded-xl font-mono text-[11px] text-[#334155] break-all border border-slate-200 select-all">
                    {resultado.assinatura.hash_conteudo}
                  </div>
                </div>

                {resultado.hashAtualCalculado && (
                  <div>
                    <span className="font-semibold text-[#1A2333] block mb-1">
                      Hash Recalculado do Demonstrativo Atual:
                    </span>
                    <div className="p-3 bg-slate-100 rounded-xl font-mono text-[11px] text-[#334155] break-all border border-slate-200">
                      {resultado.hashAtualCalculado}
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-[#64748B] flex items-start gap-2">
                  <Lock className="h-4 w-4 text-[#0FA3A3] shrink-0 mt-0.5" />
                  <p>
                    Este registro comprova que o conteúdo da demonstração contábil não sofreu
                    nenhuma adulteração pós-assinatura, em total conformidade com a MP 2.200-2/2001
                    e Lei 14.063/2020 (assinaturas eletrônicas e qualificadas no Brasil).
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Rodapé Informativo */}
      <footer className="border-t border-[#E2E8F0] bg-white py-6 px-4 text-center text-xs text-[#64748B] mt-12">
        <p className="font-semibold text-[#1A2333]">
          Plataforma Contábil Rumo — Módulo de Assinatura e Integridade ICP-Brasil
        </p>
        <p className="text-[11px] mt-1 text-[#94A3B8]">
          São Paulo / SP • CRC 2SP034821/O • Suporte a validação pública permanente
        </p>
      </footer>
    </div>
  )
}

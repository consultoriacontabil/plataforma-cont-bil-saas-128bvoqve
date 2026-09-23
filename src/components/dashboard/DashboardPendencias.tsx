import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  FileText,
  KeyRound,
  CalendarX2,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type {
  Documento,
  CertificadoDigitalRecord,
  ObrigacaoRecord,
  FechamentoCompetenciaRecord,
  Empresa,
  CompanyOnboardingWorkflowRecord,
} from '@/types'

export interface PendenciaAgregadaItem {
  id: string
  tipo: 'ged' | 'certificado' | 'obrigacao_vencida' | 'fechamento_aberto' | 'onboarding_docs'
  titulo: string
  descricao: string
  empresaNome?: string
  empresaId?: string
  criticidade: 'alta' | 'media' | 'baixa'
  rotaDestino: string
  badgeLabel: string
}

interface DashboardPendenciasProps {
  documentos: Documento[]
  certificados: CertificadoDigitalRecord[]
  obrigacoes: ObrigacaoRecord[]
  fechamentos: FechamentoCompetenciaRecord[]
  empresas: Empresa[]
  onboardingWorkflows?: CompanyOnboardingWorkflowRecord[]
  loading?: boolean
  error?: string | null
  isCliente?: boolean
}

export const DashboardPendencias: React.FC<DashboardPendenciasProps> = ({
  documentos,
  certificados,
  obrigacoes,
  fechamentos,
  empresas,
  onboardingWorkflows = [],
  loading = false,
  error = null,
  isCliente = false,
}) => {
  const navigate = useNavigate()

  // Mapa de empresas para rápida busca
  const empresasMap = useMemo(() => {
    const map = new Map<string, Empresa>()
    empresas.forEach((e) => map.set(e.id, e))
    return map
  }, [empresas])

  // Agregar todas as pendências que exigem ação do contador
  const itensPendencias = useMemo(() => {
    const itens: PendenciaAgregadaItem[] = []
    const now = new Date()

    // 1. Documentos pendentes de validação no GED
    documentos
      .filter((d) => d.status === 'pendente')
      .forEach((d) => {
        const emp = d.empresa_id ? empresasMap.get(d.empresa_id) : undefined
        const empNome = emp?.nome_fantasia || emp?.razao_social || 'Empresa Geral'
        itens.push({
          id: `ged-${d.id}`,
          tipo: 'ged',
          titulo: `Documento pendente de revisão: ${d.nome_arquivo || d.tipo}`,
          descricao: `Aguardando classificação ou processamento no GED (${d.tipo}).`,
          empresaNome: empNome,
          empresaId: d.empresa_id,
          criticidade: 'media',
          rotaDestino: isCliente ? '/portal?tab=documentos' : `/documentos?status=pendente`,
          badgeLabel: 'GED',
        })
      })

    // 2. Documentos pendentes em Workflows de Abertura (onboarding com clientes)
    onboardingWorkflows
      .filter((wf) => wf.status === 'em_analise' || wf.status === 'em_andamento')
      .forEach((wf) => {
        const docsPendentes = (wf.checklist_docs_json || []).filter(
          (item) => item.status === 'pendente' && item.obrigatorio,
        )
        if (docsPendentes.length > 0) {
          itens.push({
            id: `onboarding-${wf.id}`,
            tipo: 'onboarding_docs',
            titulo: `Documentos de Abertura pendentes: ${wf.razao_social_pretendida || wf.titulo}`,
            descricao: `${docsPendentes.length} documento(s) obrigatório(s) aguardando envio/aprovação pelo cliente.`,
            empresaNome: wf.razao_social_pretendida || wf.titulo,
            empresaId: wf.empresa_id,
            criticidade: 'alta',
            rotaDestino: `/workflow/${wf.id}`,
            badgeLabel: 'Abertura',
          })
        }
      })

    // 3. Certificados Digitais Vencidos ou Próximos do Vencimento (<= 30 dias)
    const certsPorEmpresa = new Map<string, CertificadoDigitalRecord>()
    certificados.forEach((c) => {
      if (c.empresa && !certsPorEmpresa.has(c.empresa)) {
        certsPorEmpresa.set(c.empresa, c)
      }
    })

    empresas.forEach((emp) => {
      const cert = certsPorEmpresa.get(emp.id)
      const empNome = emp.nome_fantasia || emp.razao_social

      if (!cert) {
        // Empresa sem certificado cadastrado (apenas para regimes que precisam como lucro presumido ou se tiver obrigações que exigem)
        const temObrigacaoExigente = obrigacoes.some(
          (o) => o.empresa_id === emp.id && o.exige_certificado && o.status !== 'entregue',
        )
        if (temObrigacaoExigente) {
          itens.push({
            id: `cert-ausente-${emp.id}`,
            tipo: 'certificado',
            titulo: `Certificado Digital ausente na empresa ${empNome}`,
            descricao: `Empresa possui obrigações fiscais pendentes que exigem assinatura A1/A3.`,
            empresaNome: empNome,
            empresaId: emp.id,
            criticidade: 'alta',
            rotaDestino: isCliente ? '/portal' : `/empresas/${emp.id}?tab=certificado`,
            badgeLabel: 'Certificado Ausente',
          })
        }
      } else {
        const valDate = new Date(cert.validade)
        const diffDays = Math.ceil((valDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (diffDays <= 0 || cert.status === 'expirado') {
          itens.push({
            id: `cert-exp-${cert.id}`,
            tipo: 'certificado',
            titulo: `Certificado expirado: ${empNome}`,
            descricao: `Venceu ${diffDays < 0 ? `há ${Math.abs(diffDays)} dia(s)` : 'hoje'}. Transmissões travadas.`,
            empresaNome: empNome,
            empresaId: emp.id,
            criticidade: 'alta',
            rotaDestino: isCliente ? '/portal' : `/empresas/${emp.id}?tab=certificado`,
            badgeLabel: 'Certificado Expirado',
          })
        } else if (diffDays <= 30) {
          itens.push({
            id: `cert-warn-${cert.id}`,
            tipo: 'certificado',
            titulo: `Certificado vencendo em ${diffDays} dias: ${empNome}`,
            descricao: `Validade até ${valDate.toLocaleDateString('pt-BR')}. Renove com o cliente com antecedência.`,
            empresaNome: empNome,
            empresaId: emp.id,
            criticidade: diffDays <= 7 ? 'alta' : 'media',
            rotaDestino: isCliente ? '/portal' : `/empresas/${emp.id}?tab=certificado`,
            badgeLabel: `Vence em ${diffDays}d`,
          })
        }
      }
    })

    // 4. Obrigações Vencidas (Não entregues e data anterior a hoje)
    obrigacoes
      .filter((o) => {
        if (o.status === 'entregue' || o.status === 'cancelada') return false
        const venc = new Date(o.vencimento)
        const diffDays = Math.ceil((venc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return diffDays < 0 || o.status === 'atrasada'
      })
      .forEach((o) => {
        const emp = o.empresa_id ? empresasMap.get(o.empresa_id) : undefined
        const empNome = emp?.nome_fantasia || emp?.razao_social || 'Empresa Cliente'
        const venc = new Date(o.vencimento)
        const diffDays = Math.abs(
          Math.ceil((venc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        )

        itens.push({
          id: `obr-venc-${o.id}`,
          tipo: 'obrigacao_vencida',
          titulo: `Obrigação atrasada: ${o.tipo} - ${empNome}`,
          descricao: `Venceu há ${diffDays} dia(s) (${venc.toLocaleDateString('pt-BR')}). Sujeito a multas acessórias.`,
          empresaNome: empNome,
          empresaId: o.empresa_id,
          criticidade: 'alta',
          rotaDestino: isCliente
            ? '/portal?tab=obrigacoes'
            : `/obrigacoes?status=atrasada&empresa=${o.empresa_id}`,
          badgeLabel: `${o.tipo} Atrasada`,
        })
      })

    // 5. Competências Contábeis Não Fechadas (em aberto ou em andamento)
    fechamentos
      .filter((f) => f.status === 'aberto' || f.status === 'em_andamento')
      .forEach((f) => {
        const emp = f.empresa ? empresasMap.get(f.empresa) : undefined
        const empNome = emp?.nome_fantasia || emp?.razao_social || 'Empresa'

        itens.push({
          id: `fecho-${f.id}`,
          tipo: 'fechamento_aberto',
          titulo: `Fechamento Contábil pendente: ${empNome}`,
          descricao: `Competência ${f.competencia} permanece ${f.status === 'aberto' ? 'em aberto' : 'em andamento'}.`,
          empresaNome: empNome,
          empresaId: f.empresa,
          criticidade: 'baixa',
          rotaDestino: isCliente
            ? '/portal'
            : `/fecho-mensal?empresa=${f.empresa}&competencia=${f.competencia}`,
          badgeLabel: `Fecho ${f.competencia}`,
        })
      })

    // Ordenar por criticidade (alta -> media -> baixa)
    const pesoCriticidade = { alta: 0, media: 1, baixa: 2 }
    return itens.sort((a, b) => pesoCriticidade[a.criticidade] - pesoCriticidade[b.criticidade])
  }, [
    documentos,
    certificados,
    obrigacoes,
    fechamentos,
    empresas,
    empresasMap,
    onboardingWorkflows,
    isCliente,
  ])

  const totalAltas = useMemo(
    () => itensPendencias.filter((i) => i.criticidade === 'alta').length,
    [itensPendencias],
  )

  const renderIcon = (tipo: PendenciaAgregadaItem['tipo']) => {
    switch (tipo) {
      case 'ged':
        return <FileText className="h-4 w-4 text-blue-600" />
      case 'certificado':
        return <KeyRound className="h-4 w-4 text-amber-600" />
      case 'obrigacao_vencida':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'fechamento_aberto':
        return <CalendarX2 className="h-4 w-4 text-indigo-600" />
      case 'onboarding_docs':
        return <AlertTriangle className="h-4 w-4 text-purple-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-slate-600" />
    }
  }

  const renderCriticidadeBadge = (crit: PendenciaAgregadaItem['criticidade']) => {
    switch (crit) {
      case 'alta':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px] font-bold">
            Crítica
          </Badge>
        )
      case 'media':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-semibold">
            Média
          </Badge>
        )
      case 'baixa':
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-medium">
            Rotina
          </Badge>
        )
    }
  }

  return (
    <Card className="rounded-2xl border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col h-full">
      <CardHeader className="p-5 pb-3 bg-gradient-to-r from-red-50/50 via-white to-amber-50/30 border-b border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-[#1A2333]">
                  Pendências em Destaque
                </CardTitle>
                {itensPendencias.length > 0 && (
                  <Badge className="bg-red-500 text-white font-extrabold text-[10px] px-1.5 py-0.2">
                    {itensPendencias.length}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs text-[#64748B]">
                Itens que travam rotinas e demandam resolução imediata
              </CardDescription>
            </div>
          </div>

          {totalAltas > 0 && (
            <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md hidden sm:inline-block">
              {totalAltas} ação{totalAltas > 1 ? 'ões' : ''} prioritária{totalAltas > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col">
        {error ? (
          <div className="p-6 text-center text-xs text-red-600 bg-red-50/50">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
            <p className="font-semibold">Erro ao carregar pendências</p>
            <p className="text-[11px] text-red-500 mt-1">{error}</p>
          </div>
        ) : loading ? (
          <div className="p-8 text-center text-xs text-[#64748B] space-y-2">
            <div className="h-6 w-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Varrendo pendências ativas...</p>
          </div>
        ) : itensPendencias.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#64748B] my-auto">
            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <p className="font-bold text-sm text-[#1A2333]">Nenhuma pendência crítica em aberto!</p>
            <p className="text-[11px] text-[#64748B] mt-1 max-w-xs mx-auto">
              Todos os certificados, obrigações do período, documentos GED e competências contábeis
              estão em conformidade.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
            {itensPendencias.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(item.rotaDestino)}
                className="p-3 px-4 flex items-start justify-between gap-3 hover:bg-slate-50 cursor-pointer transition-colors group"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigate(item.rotaDestino)
                  }
                }}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 mt-0.5 group-hover:border-teal-300">
                    {renderIcon(item.tipo)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-[#1A2333] group-hover:text-[#0FA3A3] transition-colors leading-tight truncate">
                        {item.titulo}
                      </p>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 border-slate-300 font-semibold text-[#64748B]"
                      >
                        {item.badgeLabel}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5 line-clamp-1 leading-snug">
                      {item.descricao}
                    </p>
                    {item.empresaNome && (
                      <span className="text-[10px] font-semibold text-slate-500 mt-0.5 block truncate">
                        Empresa: {item.empresaNome}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <div>{renderCriticidadeBadge(item.criticidade)}</div>
                  <div className="text-[#64748B] group-hover:text-[#0FA3A3] group-hover:translate-x-0.5 transition-all">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

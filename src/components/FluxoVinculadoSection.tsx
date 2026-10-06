import React, { useState } from 'react'
import {
  GitFork,
  ArrowRight,
  FileCheck2,
  Clock,
  Send,
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ShieldCheck,
  Bot,
  Building,
  RefreshCw,
  Copy,
  Check,
  UserCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { contratosService } from '@/services/contratos'
import { elisaOpsService } from '@/services/elisaOpsService'
import type {
  ContratoHonorarioRecord,
  ItemDocumentoTrilha,
  ResponsavelDocumentoItem,
} from '@/types'

interface FluxoVinculadoSectionProps {
  contrato: ContratoHonorarioRecord
  tenantId: string
  userId?: string
  onRefresh: () => void
  onOpenSolicitarAssinatura?: () => void
}

export function FluxoVinculadoSection({
  contrato,
  tenantId,
  userId,
  onRefresh,
  onOpenSolicitarAssinatura,
}: FluxoVinculadoSectionProps) {
  const { toast } = useToast()
  const [loadingAcao, setLoadingAcao] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [filtroResponsavel, setFiltroResponsavel] = useState<'todos' | 'cliente' | 'contabilidade'>(
    'todos',
  )

  const fluxoTipo = contrato.fluxo_tipo || 'nenhum'
  const isVinculado = fluxoTipo !== 'nenhum'
  const trilhaDocs: ItemDocumentoTrilha[] = contrato.trilha_documentos_json || []

  // Métricas do Paralelismo
  const totalDocs = trilhaDocs.length
  const docsCliente = trilhaDocs.filter((d) => d.responsavel === 'cliente')
  const docsContabilidade = trilhaDocs.filter((d) => d.responsavel === 'contabilidade')

  const docsClienteRecebidos = docsCliente.filter(
    (d) => d.status === 'recebido' || d.status === 'aprovado',
  ).length
  const docsContabilidadeConcluidos = docsContabilidade.filter(
    (d) => d.status === 'recebido' || d.status === 'aprovado',
  ).length

  const docsAprovadosTotal = trilhaDocs.filter(
    (d) => d.status === 'recebido' || d.status === 'aprovado',
  ).length

  const progressoDocsPercent =
    totalDocs > 0 ? Math.round((docsAprovadosTotal / totalDocs) * 100) : 0
  const progressoClientePercent =
    docsCliente.length > 0 ? Math.round((docsClienteRecebidos / docsCliente.length) * 100) : 0
  const progressoContabilidadePercent =
    docsContabilidade.length > 0
      ? Math.round((docsContabilidadeConcluidos / docsContabilidade.length) * 100)
      : 0

  // Status da Trilha de Proposta
  const statusProposta = contrato.status
  const isPropostaAssinada = statusProposta === 'assinado'
  const isPropostaEnviada = statusProposta === 'enviado'

  // Link público para solicitação de documentos ao cliente
  const linkPublicoCliente = contrato.expand?.fluxo_abertura_id?.token
    ? `${window.location.origin}/abertura/${contrato.expand.fluxo_abertura_id.token}`
    : contrato.pedido_documento_id
      ? `${window.location.origin}/pedidos-cliente/${contrato.pedido_documento_id}`
      : `${window.location.origin}/documentos-pedido/${contrato.id}`

  const handleCopiarLink = () => {
    navigator.clipboard.writeText(linkPublicoCliente)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
    toast({
      title: 'Link copiado!',
      description:
        'Link público para envio de documentos pelo cliente copiado para a área de transferência.',
    })
  }

  // Ação: Alterar status de item de documento (Marcar recebido / aprovado / recusado / pendente)
  const handleAtualizarItemStatus = async (
    itemId: string,
    novoStatus: 'pendente' | 'recebido' | 'aprovado' | 'recusado',
  ) => {
    try {
      setLoadingAcao(true)
      await contratosService.atualizarItemTrilhaDocumento({
        contratoId: contrato.id,
        itemId,
        status: novoStatus,
        usuarioId: userId,
        tenantId,
      })

      toast({
        title: 'Documento atualizado!',
        description: `Status alterado para ${novoStatus.toUpperCase()}.`,
      })
      onRefresh()
    } catch (err) {
      console.error('Erro ao atualizar item do documento:', err)
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível alterar o status do documento.',
        variant: 'destructive',
      })
    } finally {
      setLoadingAcao(false)
    }
  }

  // Ação: Disparar ou Conectar à Esteira Operacional Elliza
  const handleDispararEsteiraElliza = async () => {
    try {
      setLoadingAcao(true)
      await elisaOpsService.instanciarEsteiraParalelaContratoDocumentos({
        tenantId,
        empresaId: contrato.empresa,
        contratoId: contrato.id,
        tituloContrato: contrato.titulo,
        fluxoTipo,
        totalDocsCliente: docsCliente.length,
        totalDocsContabilidade: docsContabilidade.length,
      })

      toast({
        title: 'Esteira Elliza Ativada!',
        description: 'Processo POP-01 enfileirado com jobs paralelos para proposta e documentos.',
      })
      onRefresh()
    } catch (err) {
      console.error('Erro ao acionar esteira Elliza:', err)
      toast({
        title: 'Erro ao acionar esteira Elliza',
        description: 'Verifique as permissões de esteira operacional.',
        variant: 'destructive',
      })
    } finally {
      setLoadingAcao(false)
    }
  }

  // Ação: Registrar Parada Honesta no Modo Humano da Elliza
  const handleRegistrarParadaModoHumano = async () => {
    const pendentesCliente = docsCliente
      .filter((d) => d.status === 'pendente' || d.status === 'recusado')
      .map((d) => d.titulo)

    if (pendentesCliente.length === 0) {
      toast({
        title: 'Sem pendências críticas',
        description: 'Todos os documentos do cliente já foram entregues ou aprovados.',
      })
      return
    }

    try {
      setLoadingAcao(true)
      const processoId = contrato.elliza_processo_id || ''
      if (!processoId) {
        // Se ainda não tinha processo, cria agora
        const inst = await elisaOpsService.instanciarEsteiraParalelaContratoDocumentos({
          tenantId,
          empresaId: contrato.empresa,
          contratoId: contrato.id,
          tituloContrato: contrato.titulo,
          fluxoTipo,
          totalDocsCliente: docsCliente.length,
          totalDocsContabilidade: docsContabilidade.length,
        })
        await elisaOpsService.registrarParadaDocumentalModoHumano({
          tenantId,
          processoId: inst.processo.id,
          empresaId: contrato.empresa,
          documentosPendentesNomes: pendentesCliente,
          usuarioId: userId,
        })
      } else {
        await elisaOpsService.registrarParadaDocumentalModoHumano({
          tenantId,
          processoId,
          empresaId: contrato.empresa,
          documentosPendentesNomes: pendentesCliente,
          usuarioId: userId,
        })
      }

      toast({
        title: 'Parada Honesta Registrada (Modo Humano)',
        description: 'Pendência aberta na Fila da Elliza com indicação dos documentos faltantes.',
      })
      onRefresh()
    } catch (err) {
      console.error('Erro ao registrar parada modo humano:', err)
      toast({
        title: 'Erro ao registrar parada',
        description: 'Falha ao gerar pendência operacional.',
        variant: 'destructive',
      })
    } finally {
      setLoadingAcao(false)
    }
  }

  // Filtragem dos documentos exibidos
  const docsFiltrados = trilhaDocs.filter((d) => {
    if (filtroResponsavel === 'todos') return true
    return d.responsavel === filtroResponsavel
  })

  if (!isVinculado) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-6 bg-slate-50/60 text-center space-y-3">
        <div className="h-10 w-10 mx-auto rounded-xl bg-slate-200/80 flex items-center justify-center text-slate-600">
          <GitFork className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-800">
            Nenhum fluxo de abertura ou migração vinculado
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Para tocar a proposta e a solicitação de documentos em paralelo com separação entre
            cliente e contabilidade, vincule este documento a um fluxo de abertura ou migração.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Banner Superior do Fluxo Vinculado */}
      <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-sky-50 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-teal-600 text-white shadow-sm mt-0.5">
              <GitFork className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700">
                  {fluxoTipo === 'abertura'
                    ? 'Fluxo Vinculado: Abertura / Formação de Empresa'
                    : fluxoTipo === 'migracao_entrada'
                      ? 'Fluxo Vinculado: Migração de Entrada (Onboarding)'
                      : 'Fluxo Vinculado: Migração de Saída (Handover)'}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-white text-teal-800 border-teal-300 font-semibold"
                >
                  Trilhas Paralelas Ativas
                </Badge>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                {contrato.expand?.fluxo_abertura_id?.razao_social_pretendida ||
                  contrato.expand?.empresa?.razao_social ||
                  contrato.titulo}
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                A proposta e o checklist documental avançam sem dependência mútua. A assinatura da
                proposta não bloqueia a solicitação de documentos ao cliente nem a emissão de atos
                contábeis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopiarLink}
              className="h-8 text-xs font-medium rounded-xl border-teal-200 text-teal-800 hover:bg-teal-100/60 gap-1.5"
            >
              {copiedLink ? (
                <Check className="h-3.5 w-3.5 text-teal-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedLink ? 'Link Copiado!' : 'Link de Documentos p/ Cliente'}</span>
            </Button>

            {!contrato.elliza_processo_id ? (
              <Button
                size="sm"
                onClick={handleDispararEsteiraElliza}
                disabled={loadingAcao}
                className="h-8 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-sm"
              >
                <Bot className="h-3.5 w-3.5" />
                <span>Ativar na Fila Elliza</span>
              </Button>
            ) : (
              <Badge
                variant="secondary"
                className="h-8 px-3 rounded-xl bg-teal-100 text-teal-900 border-teal-300 flex items-center gap-1.5 text-xs"
              >
                <Bot className="h-3.5 w-3.5 text-teal-700" />
                <span>Elliza Conectada (POP-01)</span>
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Grid: 2 Trilhas Paralelas Lado a Lado (Proposta | Documentos) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TRILHA 1: Proposta de Honorários */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Trilha da Proposta Comercial</h4>
                <p className="text-[11px] text-slate-500">
                  Tramitação, envio e aceite formal do cliente
                </p>
              </div>
            </div>
            <Badge
              className={`text-[11px] font-semibold px-2.5 py-0.5 capitalize ${
                isPropostaAssinada
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : isPropostaEnviada
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              {contrato.status === 'rascunho'
                ? 'Rascunho'
                : contrato.status === 'enviado'
                  ? 'Aguardando Assinatura'
                  : contrato.status === 'assinado'
                    ? 'Assinada / Ativa'
                    : contrato.status}
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-500 block text-[11px]">Honorário Mensal:</span>
                <span className="font-bold text-slate-800 text-sm">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                    contrato.valor_mensal || 0,
                  )}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Vencimento Mensal:</span>
                <span className="font-semibold text-slate-800">
                  Dia {contrato.dia_vencimento || 10}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Modelo:</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {(contrato.modelo_mensalidade || 'mensal_fixo').replace('_', ' ')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Vigência:</span>
                <span className="font-semibold text-slate-800">
                  {contrato.prazo_contrato || 12} meses
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-sky-100 bg-sky-50/50 flex items-start gap-2.5 text-xs text-sky-900">
              <ShieldCheck className="h-4 w-4 text-sky-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Independência Operacional</span>
                <p className="text-[11px] text-sky-800/90 mt-0.5">
                  A assinatura formal da proposta não bloqueia a coleta dos documentos. A
                  contabilidade pode protocolar viabilidade e redigir o contrato social enquanto o
                  cliente analisa os termos comerciais.
                </p>
              </div>
            </div>

            {onOpenSolicitarAssinatura && statusProposta === 'rascunho' && (
              <Button
                onClick={onOpenSolicitarAssinatura}
                className="w-full h-9 rounded-xl text-xs font-semibold bg-[#0B1F3A] hover:bg-[#1A2333] text-white gap-2 shadow-sm"
              >
                <Send className="h-3.5 w-3.5 text-teal-400" />
                <span>Disparar Proposta para Assinatura</span>
              </Button>
            )}
          </div>
        </div>

        {/* TRILHA 2: Solicitação & Checklist de Documentos */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Trilha de Documentos & Atos</h4>
                <p className="text-[11px] text-slate-500">
                  Coleta com o cliente e emissão pelo escritório
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-teal-700">
                {docsAprovadosTotal}/{totalDocs} Concluídos ({progressoDocsPercent}%)
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Progress value={progressoDocsPercent} className="h-2 rounded-full bg-slate-100" />

            {/* Sub-barras: Cliente vs Contabilidade */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/40">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5 text-amber-700" />
                    Cliente ({docsClienteRecebidos}/{docsCliente.length})
                  </span>
                  <span className="text-xs font-bold text-amber-900">
                    {progressoClientePercent}%
                  </span>
                </div>
                <Progress value={progressoClientePercent} className="h-1.5 bg-amber-100" />
                <span className="text-[10px] text-amber-800/80 block mt-1.5">
                  {docsCliente.length - docsClienteRecebidos > 0
                    ? `${docsCliente.length - docsClienteRecebidos} documento(s) pendente(s) do cliente`
                    : 'Todos os documentos do cliente entregues!'}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/40">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                    <Building className="h-3.5 w-3.5 text-indigo-700" />
                    Contabilidade ({docsContabilidadeConcluidos}/{docsContabilidade.length})
                  </span>
                  <span className="text-xs font-bold text-indigo-900">
                    {progressoContabilidadePercent}%
                  </span>
                </div>
                <Progress value={progressoContabilidadePercent} className="h-1.5 bg-indigo-100" />
                <span className="text-[10px] text-indigo-800/80 block mt-1.5">
                  {docsContabilidade.length - docsContabilidadeConcluidos > 0
                    ? `${docsContabilidade.length - docsContabilidadeConcluidos} ato(s) pendente(s) do escritório`
                    : 'Todos os atos do escritório concluídos!'}
                </span>
              </div>
            </div>

            {/* Ações Rápidas da Trilha Documental */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopiarLink}
                className="flex-1 h-8 text-xs font-medium rounded-xl border-slate-200 gap-1.5 text-slate-700"
              >
                <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                <span>Solicitar por Link ao Cliente</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRegistrarParadaModoHumano}
                disabled={loadingAcao}
                className="h-8 text-xs font-medium rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 gap-1.5"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                <span>Parada Modo Humano</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* CHECKLIST DETALHADO COM RESPONSABILIDADE EXPLICITA */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Checklist Documental com Responsabilidade por Item
            </h4>
            <p className="text-xs text-slate-500">
              Classificação explícita do que cabe ao Cliente anexar e o que é de emissão da
              Contabilidade.
            </p>
          </div>

          {/* Filtros de Responsável */}
          <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setFiltroResponsavel('todos')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filtroResponsavel === 'todos'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({totalDocs})
            </button>
            <button
              type="button"
              onClick={() => setFiltroResponsavel('cliente')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                filtroResponsavel === 'cliente'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="h-3 w-3" />
              <span>Cliente ({docsCliente.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFiltroResponsavel('contabilidade')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                filtroResponsavel === 'contabilidade'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="h-3 w-3" />
              <span>Contabilidade ({docsContabilidade.length})</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {docsFiltrados.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Nenhum documento encontrado para este filtro de responsável.
            </div>
          ) : (
            docsFiltrados.map((item) => {
              const isCliente = item.responsavel === 'cliente'
              const isConcluido = item.status === 'recebido' || item.status === 'aprovado'
              const isPendente = item.status === 'pendente'
              const isRecusado = item.status === 'recusado'

              return (
                <div
                  key={item.id}
                  className="p-4 px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isConcluido
                          ? 'bg-emerald-100 text-emerald-700'
                          : isRecusado
                            ? 'bg-rose-100 text-rose-700'
                            : isCliente
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {isConcluido ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isRecusado ? (
                        <XCircle className="h-4 w-4" />
                      ) : isCliente ? (
                        <UserCheck className="h-4 w-4" />
                      ) : (
                        <Building className="h-4 w-4" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{item.titulo}</span>
                        {/* Badge de Responsabilidade */}
                        {isCliente ? (
                          <Badge className="text-[10px] bg-amber-100 text-amber-900 border-amber-300 font-semibold gap-1">
                            <UserCheck className="h-3 w-3" />
                            Responsabilidade: Cliente
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-indigo-100 text-indigo-900 border-indigo-300 font-semibold gap-1">
                            <Building className="h-3 w-3" />
                            Responsabilidade: Contabilidade
                          </Badge>
                        )}

                        {item.obrigatorio && (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            Obrigatório
                          </span>
                        )}
                      </div>

                      {item.descricao && (
                        <p className="text-xs text-slate-600 leading-relaxed">{item.descricao}</p>
                      )}

                      {item.nome_arquivo && (
                        <div className="flex items-center gap-1.5 text-[11px] text-teal-700 font-medium pt-0.5">
                          <FileCheck2 className="h-3.5 w-3.5" />
                          <span>Arquivo anexado: {item.nome_arquivo}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status do Item e Ações */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-semibold capitalize ${
                        isConcluido
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : isRecusado
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {item.status}
                    </Badge>

                    {isPendente ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAtualizarItemStatus(item.id, 'recebido')}
                          disabled={loadingAcao}
                          className="h-7 text-xs rounded-lg border-emerald-200 text-emerald-800 hover:bg-emerald-50 gap-1 font-medium"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Marcar Recebido</span>
                        </Button>
                      </div>
                    ) : isRecusado ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAtualizarItemStatus(item.id, 'pendente')}
                        disabled={loadingAcao}
                        className="h-7 text-xs rounded-lg border-slate-200 text-slate-700 gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Reabrir</span>
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAtualizarItemStatus(item.id, 'recusado')}
                          disabled={loadingAcao}
                          className="h-7 px-2 text-xs rounded-lg text-rose-600 hover:bg-rose-50"
                        >
                          Recusar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAtualizarItemStatus(item.id, 'pendente')}
                          disabled={loadingAcao}
                          className="h-7 px-2 text-xs rounded-lg text-slate-500 hover:bg-slate-100"
                        >
                          Desmarcar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

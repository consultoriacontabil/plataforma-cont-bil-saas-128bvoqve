import { useRef } from 'react'
import {
  Compass,
  Printer,
  Download,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Building2,
  Calendar,
  DollarSign,
  AlertCircle,
  FileCheck2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDatePtBr } from '@/lib/formatters'
import { useAuth } from '@/contexts/AuthContext'
import type {
  ContratoHonorarioRecord,
  Empresa,
  AssinaturaDemonstrativoRecord,
  ClausulaContrato,
  Tenant,
} from '@/types'

interface ContratoModalViewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contrato: ContratoHonorarioRecord | null
  empresa?: Empresa | null
  assinatura?: AssinaturaDemonstrativoRecord | null
  tenant?: Tenant | null
  tenantNome?: string
  tenantCnpj?: string
  canSign?: boolean
  canReject?: boolean
  onAssinar?: () => void
  onRecusar?: () => void
  actionLoading?: boolean
}

export function ContratoModalView({
  open,
  onOpenChange,
  contrato,
  empresa,
  assinatura,
  tenant: tenantProp,
  tenantNome: tenantNomeProp,
  tenantCnpj: tenantCnpjProp,
  canSign = false,
  canReject = false,
  onAssinar,
  onRecusar,
  actionLoading = false,
}: ContratoModalViewProps) {
  const printAreaRef = useRef<HTMLDivElement>(null)
  const { tenant: authTenant } = useAuth()
  const tenant = tenantProp || authTenant
  const tenantNome = tenantNomeProp || tenant?.nome || 'Rumo Consultoria Contábil'
  const tenantCnpj = tenantCnpjProp || tenant?.cnpj || '12.345.678/0001-90'

  if (!contrato) return null

  const handlePrint = () => {
    window.print()
  }

  const clausulas: ClausulaContrato[] = Array.isArray(contrato.clausulas) ? contrato.clausulas : []

  const isAssinado = contrato.status === 'assinado' || assinatura?.status === 'assinada'
  const isEnviado = contrato.status === 'enviado'
  const isRecusado = contrato.status === 'recusado'

  const nomeCliente =
    empresa?.razao_social ||
    empresa?.nome_fantasia ||
    contrato.expand?.empresa?.razao_social ||
    contrato.expand?.empresa?.nome_fantasia ||
    'Cliente / Prospect em Prospecção'

  const cnpjCliente = empresa?.cnpj || contrato.expand?.empresa?.cnpj || ''

  const modeloFormatado: Record<string, string> = {
    mensal_fixo: 'Mensalidade Fixa Mensal',
    por_funcionario: 'Base Variável por Funcionário Ativo',
    por_notas: 'Base Variável por Volume de Notas Fiscais',
    eventuais: 'Honorários por Demandas Eventuais / BPO',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white border-[#E2E8F0]">
        {/* Topbar com Ações */}
        <DialogHeader className="p-4 px-6 border-b border-[#E2E8F0] flex flex-row items-center justify-between no-print bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0FA3A3] to-[#123B6D] text-white shadow-xs">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#1A2333] flex items-center gap-2">
                <span>{contrato.titulo}</span>
                <Badge
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 ${
                    isAssinado
                      ? 'bg-emerald-600 text-white'
                      : isEnviado
                        ? 'bg-blue-600 text-white'
                        : isRecusado
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {contrato.status.toUpperCase()}
                </Badge>
              </DialogTitle>
              <p className="text-xs text-[#64748B]">
                {contrato.tipo === 'proposta'
                  ? 'Proposta Comercial de Honorários'
                  : 'Contrato de Prestação de Serviços Contábeis'}{' '}
                • Rumo Consultoria Contábil
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="rounded-xl text-xs font-semibold h-9 gap-1.5 border-[#E2E8F0]"
            >
              <Printer className="h-4 w-4 text-[#0FA3A3]" />
              <span className="hidden sm:inline">Imprimir / Salvar PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Corpo do Documento Formal Contábil (Pronto para Visualização e Print-to-PDF) */}
        <div
          className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 bg-[#FBFBFC]"
          ref={printAreaRef}
        >
          <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-6 text-[#1A2333] print:border-none print:shadow-none print:p-0">
            {/* Cabeçalho do Escritório Contábil com CRC */}
            <div className="border-b-2 border-[#123B6D] pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0B1F3A] text-white shadow-sm shrink-0">
                  <Compass className="h-7 w-7 text-[#0FA3A3]" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-[#0B1F3A] tracking-tight">{tenantNome}</h1>
                  <p className="text-xs font-bold text-[#0FA3A3] uppercase tracking-wide">
                    Assessoria, Auditoria & Consultoria Contábil
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    CNPJ: {tenantCnpj} • {tenant?.crc_responsavel || 'CRC/SP 2SP034821/O'}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right text-xs text-[#64748B]">
                <Badge variant="outline" className="border-[#0FA3A3] text-[#0FA3A3] font-bold">
                  {contrato.tipo === 'proposta'
                    ? 'PROPOSTA DE HONORÁRIOS'
                    : 'INSTRUMENTO CONTRATUAL'}
                </Badge>
                <p className="mt-1 text-[11px] font-mono">
                  Ref.: CTR-{contrato.id.slice(0, 8).toUpperCase()}
                </p>
                <p className="text-[11px]">
                  Emissão: {contrato.created ? formatDatePtBr(contrato.created) : '15/09/2026'}
                </p>
              </div>
            </div>

            {/* Título Principal */}
            <div className="text-center py-2 space-y-1">
              <h2 className="text-lg md:text-xl font-extrabold uppercase tracking-tight text-[#0B1F3A]">
                {contrato.tipo === 'proposta'
                  ? 'PROPOSTA COMERCIAL PARA PRESTAÇÃO DE SERVIÇOS CONTÁBEIS'
                  : 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS CONTÁBEIS'}
              </h2>
              <p className="text-xs text-[#64748B]">
                Instrumento particular firmado em conformidade com as Resoluções do Conselho Federal
                de Contabilidade (CFC) e Código Civil
              </p>
            </div>

            {/* Qualificação das Partes */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2">
              <p className="leading-relaxed">
                <strong className="text-[#0B1F3A]">CONTRATADA:</strong>{' '}
                <span className="font-semibold">{tenantNome}</span>, sociedade de serviços
                contábeis, inscrita no CNPJ sob o nº{' '}
                <span className="font-mono font-semibold">{tenantCnpj}</span> e no Conselho Regional
                de Contabilidade sob o registro{' '}
                <span className="font-semibold text-[#0FA3A3]">
                  {tenant?.crc_responsavel || 'CRC/SP 2SP034821/O'}
                </span>
                , com sede na Avenida Paulista, São Paulo/SP.
              </p>
              <p className="leading-relaxed">
                <strong className="text-[#0B1F3A]">CONTRATANTE / TOMADORA:</strong>{' '}
                <span className="font-semibold">{nomeCliente}</span>
                {cnpjCliente ? (
                  <>
                    , inscrita no CNPJ/MF sob o nº{' '}
                    <span className="font-mono font-semibold">{cnpjCliente}</span>
                  </>
                ) : (
                  ' (Proposta comercial apresentada para qualificação cadastral)'
                )}
                .
              </p>
            </div>

            {/* Quadro Resumo dos Parâmetros Comerciais */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50/70 border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase block">
                  Modelo de Cobrança
                </span>
                <span className="font-bold text-[#1A2333]">
                  {modeloFormatado[contrato.modelo_mensalidade] || contrato.modelo_mensalidade}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase block">
                  Honorário Mensal
                </span>
                <span className="font-extrabold text-[#0FA3A3] text-sm">
                  R$ {contrato.valor_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase block">
                  Dia de Vencimento
                </span>
                <span className="font-bold text-[#1A2333]">Todo dia {contrato.dia_vencimento}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#64748B] uppercase block">
                  Prazo / Vigência
                </span>
                <span className="font-bold text-[#1A2333]">
                  {contrato.prazo_contrato} meses
                  {contrato.data_inicio ? ` (Início ${formatDatePtBr(contrato.data_inicio)})` : ''}
                </span>
              </div>
            </div>

            {/* Cláusulas Contratuais */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0FA3A3] border-b pb-1">
                Cláusulas e Condições Gerais da Contratação
              </h3>

              <div className="space-y-4 text-xs leading-relaxed text-[#334155]">
                {clausulas.map((c, idx) => (
                  <div key={idx} className="space-y-1">
                    <h4 className="font-bold text-[#0B1F3A] text-xs">{c.titulo}</h4>
                    <p className="text-justify text-xs text-slate-700 whitespace-pre-line">
                      {c.texto}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerta de Recusa se Houver */}
            {isRecusado && contrato.observacoes_recusa && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
                <div className="flex items-center gap-2 font-bold mb-1 text-rose-700">
                  <AlertCircle className="h-4 w-4" />
                  <span>Proposta / Contrato Recusado com Apontamento</span>
                </div>
                <p className="italic font-mono text-[11px]">"{contrato.observacoes_recusa}"</p>
              </div>
            )}

            {/* Selo Verde de Assinatura Digital e Verificação de Autenticidade */}
            {isAssinado && assinatura ? (
              <div className="p-4 rounded-2xl bg-emerald-50/80 border-2 border-emerald-300 text-emerald-950 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-700" />
                    <span className="font-bold text-xs uppercase tracking-wider text-emerald-900">
                      Documento Assinado Eletronicamente — Integridade SHA-256 Garantida
                    </span>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                    CONTRATO OFICIAL AUTÊNTICO
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-emerald-800 font-semibold block">Assinante Titular:</span>
                    <span className="font-bold text-emerald-950">{assinatura.assinante}</span>
                    <span className="text-[10px] text-emerald-700 block">
                      {assinatura.cargo_cpf}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-800 font-semibold block">Data / Hora:</span>
                    <span className="font-medium text-emerald-950">
                      {assinatura.data_assinatura
                        ? formatDatePtBr(assinatura.data_assinatura)
                        : 'Confirmado'}
                    </span>
                    {assinatura.ip_assinatura && (
                      <span className="text-[10px] text-emerald-700 font-mono block">
                        IP: {assinatura.ip_assinatura}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-emerald-800 font-semibold block">Validação Legal:</span>
                    <span className="text-[10px] text-emerald-900 leading-tight block">
                      MP 2.200-2/2001 & Lei 14.063/2020
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] gap-2">
                  <span className="font-mono text-[10px] text-emerald-800">
                    Hash: <b className="font-mono">{assinatura.hash_conteudo.slice(0, 24)}...</b>
                    {' • '}
                    Token: <b className="font-mono">{assinatura.token_verificacao}</b>
                  </span>

                  <a
                    href={`/verificar-assinatura?token=${encodeURIComponent(
                      assinatura.token_verificacao,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:text-emerald-950 underline text-[11px]"
                  >
                    <span>Consultar em /verificar-assinatura</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ) : null}

            {/* Linhas de Assinatura */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 text-center text-xs">
              <div className="space-y-1">
                <div className="border-t border-slate-800 w-3/4 mx-auto" />
                <p className="font-bold text-[#0B1F3A]">
                  {isAssinado && assinatura ? assinatura.assinante : nomeCliente}
                </p>
                <p className="text-[10px] text-[#64748B]">
                  {isAssinado && assinatura
                    ? `${assinatura.cargo_cpf} • Assinatura Eletrônica Registrada`
                    : 'Responsável Legal da CONTRATANTE'}
                </p>
              </div>

              <div className="space-y-1">
                <div className="border-t border-slate-800 w-3/4 mx-auto" />
                <p className="font-bold text-[#0B1F3A]">
                  {tenant?.responsavel_tecnico || 'Contador Responsável Técnico'}
                </p>
                <p className="text-[10px] text-[#64748B]">
                  {tenant?.crc_responsavel || 'CRC/SP 2SP034821/O'} • {tenantNome}
                </p>
              </div>
            </div>

            {/* Rodapé Informativo */}
            <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-[#64748B] flex flex-wrap items-center justify-between gap-2">
              <span>
                Rumo Consultoria Contábil • Plataforma de Assinatura Digital e Gestão SaaS
              </span>
              <a
                href={
                  assinatura
                    ? `/verificar-assinatura?token=${encodeURIComponent(
                        assinatura.token_verificacao,
                      )}`
                    : '/verificar-assinatura'
                }
                target="_blank"
                rel="noreferrer"
                className="text-[#0FA3A3] hover:underline font-semibold flex items-center gap-1"
              >
                <span>Verificar autenticidade pública deste documento</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal (Ações de Assinatura para Portal do Cliente) */}
        <DialogFooter className="p-4 px-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between no-print">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs text-[#64748B]"
          >
            Fechar
          </Button>

          {canSign && isEnviado && (
            <div className="flex items-center gap-2">
              {canReject && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onRecusar}
                  disabled={actionLoading}
                  className="rounded-xl text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  Recusar Proposta
                </Button>
              )}
              <Button
                type="button"
                onClick={onAssinar}
                disabled={actionLoading}
                className="rounded-xl text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white shadow-xs gap-1.5"
              >
                <FileCheck2 className="h-4 w-4" />
                <span>{actionLoading ? 'Processando...' : 'Revisar & Assinar Digitalmente'}</span>
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

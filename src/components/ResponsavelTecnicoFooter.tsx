import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface ResponsavelTecnicoDados {
  nome?: string | null
  crc?: string | null
  cargo?: string | null
  escritorio?: string | null
}

export interface ResponsavelTecnicoFooterProps {
  /** Variante visual de exibição */
  variant?: 'formal-footer' | 'header-badge' | 'compact-inline' | 'print-signature'
  /** Sobrescrever dados do tenant (ex: em páginas de cliente onde vem da empresa ou do contrato) */
  tenantOverride?: {
    responsavel_tecnico?: string | null
    crc_responsavel?: string | null
    nome?: string | null
    razao_social?: string | null
  } | null
  /** Data de emissão ou competência a ser exibida */
  dataEmissao?: string | Date
  /** Norma técnica ou resolução legal de referência (ex: 'Resolução CFC 1.496/2015', 'NBC PG 01') */
  norma?: string
  /** Classes adicionais para o container */
  className?: string
  /** Ocultar link para perfil no fallback */
  hideLinkOnMissing?: boolean
}

export const ResponsavelTecnicoFooter: React.FC<ResponsavelTecnicoFooterProps> = ({
  variant = 'formal-footer',
  tenantOverride,
  dataEmissao,
  norma = 'Resolução CFC 1.496/2015 & NBC PG 01',
  className = '',
  hideLinkOnMissing = false,
}) => {
  const { tenant } = useAuth()

  const responsavelNome = (
    tenantOverride?.responsavel_tecnico ?? tenant?.responsavel_tecnico
  )?.trim()
  const responsavelCrc = (tenantOverride?.crc_responsavel ?? tenant?.crc_responsavel)?.trim()
  const escritorioNome = (
    tenantOverride?.nome ??
    tenantOverride?.razao_social ??
    tenant?.nome ??
    tenant?.razao_social ??
    'Escritório Contábil'
  )?.trim()

  const hasResponsavel = Boolean(responsavelNome && responsavelCrc)

  const dataFormatada = dataEmissao
    ? typeof dataEmissao === 'string'
      ? dataEmissao
      : dataEmissao.toLocaleDateString('pt-BR')
    : undefined

  // Fallback quando não há dados cadastrados
  if (!hasResponsavel) {
    if (variant === 'compact-inline' || variant === 'header-badge') {
      return (
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md ${className}`}
          title="Responsável Técnico não cadastrado no Perfil do Escritório"
        >
          <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
          <span>Responsável Técnico: [cadastrar no Perfil]</span>
        </span>
      )
    }

    return (
      <div
        className={`p-3 bg-amber-50/90 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center justify-between gap-2 print:border-amber-400 ${className}`}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <span className="font-semibold">Responsável Técnico: [cadastrar no Perfil]</span>
            <span className="block text-[11px] text-amber-700">
              Conforme normas do CFC ({norma}), documentos e demonstrativos contábeis exigem a
              indicação do profissional habilitado.
            </span>
          </div>
        </div>
        {!hideLinkOnMissing && (
          <Link
            to="/perfil"
            className="text-xs font-semibold text-amber-900 underline hover:text-amber-700 whitespace-nowrap print:hidden"
          >
            Cadastrar agora
          </Link>
        )}
      </div>
    )
  }

  // 1. VARIANTE: HEADER-BADGE (Cabeçalhos de relatórios executivos ou modais)
  if (variant === 'header-badge') {
    return (
      <div
        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-xs ${className}`}
      >
        <span className="font-semibold text-slate-900">{responsavelNome}</span>
        <span className="text-slate-300">•</span>
        <span className="font-mono text-slate-600 text-[11px]">{responsavelCrc}</span>
        <span className="text-slate-300">•</span>
        <span className="text-slate-500 text-[11px]">{escritorioNome}</span>
      </div>
    )
  }

  // 2. VARIANTE: COMPACT-INLINE (Linha única discreta em tabelas ou resumos)
  if (variant === 'compact-inline') {
    return (
      <span className={`text-xs text-slate-600 ${className}`}>
        <strong className="text-slate-800 font-medium">{responsavelNome}</strong> ({responsavelCrc})
        {escritorioNome && <span className="text-slate-500"> • {escritorioNome}</span>}
      </span>
    )
  }

  // 3. VARIANTE: PRINT-SIGNATURE (Bloco de assinatura para impressão física ou digital)
  if (variant === 'print-signature') {
    return (
      <div className={`text-center space-y-1 ${className}`}>
        <div className="w-64 border-t border-slate-900 mx-auto pt-2 print:border-black" />
        <p className="font-bold text-sm text-slate-900 print:text-black">{responsavelNome}</p>
        <p className="text-xs font-medium text-slate-700 print:text-black">
          Contador(a) Responsável Técnico(a)
        </p>
        <p className="text-xs font-mono text-slate-600 print:text-black">{responsavelCrc}</p>
        {escritorioNome && (
          <p className="text-[11px] text-slate-500 print:text-black">{escritorioNome}</p>
        )}
        {dataFormatada && (
          <p className="text-[10px] text-slate-400 print:text-black pt-1">
            Emissão: {dataFormatada}
          </p>
        )}
      </div>
    )
  }

  // 4. VARIANTE PADRÃO: FORMAL-FOOTER (Rodapé institucional completo de balancetes, relatórios e contratos)
  return (
    <footer
      className={`border-t border-slate-200 bg-slate-50/70 p-4 rounded-xl text-slate-700 print:bg-white print:border-black print:p-2 ${className}`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900">{responsavelNome}</span>
            <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-slate-200 text-slate-800 print:border print:border-slate-400">
              {responsavelCrc}
            </span>
            <span className="text-slate-400">•</span>
            <span className="font-medium text-slate-700">Contador(a) Responsável Técnico(a)</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
            <span>{escritorioNome}</span>
            {dataFormatada && (
              <>
                <span className="text-slate-300">•</span>
                <span>Emissão: {dataFormatada}</span>
              </>
            )}
            {norma && (
              <>
                <span className="text-slate-300">•</span>
                <span className="italic">Conforme {norma}</span>
              </>
            )}
          </div>
        </div>

        <div className="text-[10px] text-slate-400 text-right print:text-slate-600">
          Documento contábil emitido sob responsabilidade técnica profissional registrada.
        </div>
      </div>
    </footer>
  )
}

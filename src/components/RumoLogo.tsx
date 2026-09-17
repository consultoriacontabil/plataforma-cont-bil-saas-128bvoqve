import React from 'react'
import { cn } from '@/lib/utils'

export interface RumoLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Tamanho da insígnia / ícone (em pixels ou classe personalizada se iconOnly)
   * Padrão: 40px
   */
  size?: number
  /**
   * Se true, exibe apenas a insígnia quadrada/ícone (ideal para sidebar colapsado, avatares, favicon)
   */
  iconOnly?: boolean
  /**
   * Variante de tema:
   * - 'dark': para fundos escuros (#0B1F3A, painel login), texto branco e subtítulo slate-400
   * - 'light': para fundos claros (topbars brancos), texto navy #0B1F3A e subtítulo slate-500
   * - 'monochrome-white': insígnia e textos 100% brancos
   */
  variant?: 'dark' | 'light' | 'monochrome-white'
  /**
   * Personalização do texto principal (padrão: "Rumo")
   */
  title?: string
  /**
   * Personalização do subtítulo (padrão: "CONSULTORIA CONTÁBIL")
   */
  subtitle?: string
  /**
   * Ocultar o subtítulo mesmo quando não for iconOnly
   */
  hideSubtitle?: boolean
  /**
   * Estilo do container da insígnia:
   * - 'gradient': quadrado arredondado com gradiente padrão (#0FA3A3 -> #123B6D)
   * - 'teal': quadrado arredondado com gradiente verde-petróleo (#0FA3A3 -> #0C8585)
   * - 'flat-dark': quadrado navy sólido (#0B1F3A)
   * - 'none': sem moldura (apenas o vetor do monograma)
   */
  badgeStyle?: 'gradient' | 'teal' | 'flat-dark' | 'none'
  /**
   * Classes extras para a moldura da insígnia
   */
  badgeClassName?: string
}

/**
 * Insígnia Vetorial da Marca Rumo:
 * Monograma moderno combinando a letra "R", a bússola/rosa dos ventos náutica
 * e uma seta de crescimento/ascensão contábil num design profissional, geométrico e nítido.
 */
export const RumoIcon: React.FC<{
  className?: string
  size?: number
  color?: string
}> = ({ className, size = 24, color }) => {
  return (
    <svg
      viewBox="0 0 36 36"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 select-none', className)}
      aria-hidden="true"
    >
      <defs>
        {/* Gradiente sutil da lâmina superior */}
        <linearGradient
          id="rumo-compass-cyan"
          x1="4"
          y1="4"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E0F7FA" />
        </linearGradient>
        {/* Gradiente da perna/vetor do R */}
        <linearGradient
          id="rumo-compass-accent"
          x1="18"
          y1="18"
          x2="30"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#5EEAD4" />
          <stop offset="100%" stopColor="#2DD4BF" />
        </linearGradient>
      </defs>

      {/* 1. Anel externo estilizado da bússola com aberturas de navegação */}
      <circle
        cx="18"
        cy="18"
        r="14.5"
        stroke={color || 'currentColor'}
        strokeWidth="1.8"
        strokeOpacity="0.45"
        strokeDasharray="5 2.5"
      />

      {/* 2. Marcadores cardeais sutis (Norte, Leste, Sul, Oeste) */}
      <line
        x1="18"
        y1="1.5"
        x2="18"
        y2="4.5"
        stroke={color || 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="18"
        y1="31.5"
        x2="18"
        y2="34.5"
        stroke={color || 'currentColor'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />
      <line
        x1="1.5"
        y1="18"
        x2="4.5"
        y2="18"
        stroke={color || 'currentColor'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />
      <line
        x1="31.5"
        y1="18"
        x2="34.5"
        y2="18"
        stroke={color || 'currentColor'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />

      {/* 3. Coluna vertical sólida da haste esquerda do "R" */}
      <path
        d="M10 8.5C10 7.67157 10.6716 7 11.5 7H13.5C14.3284 7 15 7.67157 15 8.5V27.5C15 28.3284 14.3284 29 13.5 29H11.5C10.6716 29 10 28.3284 10 27.5V8.5Z"
        fill={color || 'currentColor'}
      />

      {/* 4. Arco superior do "R" fundido com a agulha de navegação (Norte-Nordeste) */}
      <path
        d="M13.5 7H20.5C23.5376 7 26 9.46243 26 12.5C26 15.5376 23.5376 18 20.5 18H13.5V7Z"
        stroke={color || 'currentColor'}
        strokeWidth="3.2"
        strokeLinejoin="round"
      />

      {/* 5. Agulha/vetor direcional de Rumo: perna inclinada dinâmica do "R" apontando ao sudeste como uma seta de crescimento */}
      <path
        d="M17 17L25.8 28.2C26.3 28.8 27.2 28.8 27.6 28.2L28.2 27.4C28.6 26.8 28.5 26 27.9 25.4L20.2 16.2"
        fill="url(#rumo-compass-accent)"
        stroke={color || 'currentColor'}
        strokeWidth="1"
      />

      {/* 6. Vértice da bússola / Agulha central apontando ao Norte (direção, Rumo) */}
      <polygon points="18,10.5 21,17 18,15.5 15,17" fill={color || '#FFFFFF'} />
    </svg>
  )
}

/**
 * Componente principal da Logo da Rumo Contábil
 */
export const RumoLogo: React.FC<RumoLogoProps> = ({
  size = 40,
  iconOnly = false,
  variant = 'dark',
  title = 'Rumo',
  subtitle = 'Consultoria Contábil',
  hideSubtitle = false,
  badgeStyle = 'gradient',
  badgeClassName,
  className,
  ...props
}) => {
  // Proporção do ícone interno em relação ao container quadrado
  const innerIconSize = Math.round(size * 0.58)

  const getBadgeStyleClass = () => {
    switch (badgeStyle) {
      case 'teal':
        return 'bg-gradient-to-tr from-[#0FA3A3] to-[#0D8787] text-white shadow-md'
      case 'flat-dark':
        return 'bg-[#0B1F3A] text-white border border-[#123B6D]'
      case 'none':
        return 'bg-transparent text-white'
      case 'gradient':
      default:
        return 'bg-gradient-to-tr from-[#0FA3A3] to-[#123B6D] text-white shadow-md'
    }
  }

  const isLight = variant === 'light'
  const isMono = variant === 'monochrome-white'

  return (
    <div
      className={cn('flex items-center gap-3 overflow-hidden select-none', className)}
      {...props}
    >
      {/* Insígnia / Quadrado de Identidade */}
      <div
        style={{ width: size, height: size }}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl transition-all',
          getBadgeStyleClass(),
          badgeClassName,
        )}
      >
        <RumoIcon size={innerIconSize} />
      </div>

      {/* Wordmark (Nome + Subtítulo) */}
      {!iconOnly && (
        <div className="flex flex-col min-w-0 leading-tight">
          <span
            className={cn(
              'font-extrabold tracking-tight',
              size >= 48 ? 'text-2xl' : size >= 40 ? 'text-lg' : 'text-base',
              isMono ? 'text-white' : isLight ? 'text-[#0B1F3A]' : 'text-white',
            )}
          >
            {title}
          </span>
          {!hideSubtitle && subtitle && (
            <span
              className={cn(
                'uppercase tracking-widest font-semibold',
                size >= 48 ? 'text-[11px]' : 'text-[10px]',
                isMono ? 'text-teal-200/80' : isLight ? 'text-[#64748B]' : 'text-[#94A3B8]',
              )}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default RumoLogo

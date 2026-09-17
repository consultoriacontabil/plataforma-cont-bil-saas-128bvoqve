import React from 'react'
import { cn } from '@/lib/utils'

export interface RumoLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Tamanho da insígnia / ícone (em pixels ou classe personalizada se iconOnly)
   * Padrão: 40px
   */
  size?: number
  /**
   * Se true, exibe apenas a insígnia circular/ícone (ideal para sidebar colapsado, avatares, favicon)
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
   * Personalização do subtítulo (padrão: "Consultoria Contábil")
   */
  subtitle?: string
  /**
   * Ocultar o subtítulo mesmo quando não for iconOnly
   */
  hideSubtitle?: boolean
  /**
   * Estilo do container da insígnia:
   * - 'navy': círculo azul-marinho oficial (#0B1F3A / #002244) conforme marca do cliente
   * - 'gradient': círculo com gradiente sutil navy (#002244 -> #0B1F3A)
   * - 'teal': círculo com toque azul-petróleo / navy
   * - 'flat-dark': círculo navy sólido (#002244)
   * - 'none': sem moldura (apenas o símbolo vetorial central)
   */
  badgeStyle?: 'navy' | 'gradient' | 'teal' | 'flat-dark' | 'none'
  /**
   * Classes extras para a moldura da insígnia
   */
  badgeClassName?: string
}

/**
 * Insígnia Vetorial da Marca Rumo Oficial:
 * Emblema geométrico simétrico com círculo azul-marinho (#002244) e símbolo branco angular centralizado:
 * - Losango externo estilizado com asas dobradas laterais e notch inferior em V;
 * - Chevron / seta central apontando para cima (ascensão, rumo, direção, crescimento contábil);
 * - Forma do topo com fold/dobra angular e corte inferior em ângulo reto.
 */
export const RumoIcon: React.FC<{
  className?: string
  size?: number
  color?: string
  /**
   * Se true, renderiza o círculo azul-marinho de fundo com o símbolo branco dentro
   * Se false (padrão), renderiza o símbolo com a cor especificada ou currentColor
   */
  withBackground?: boolean
}> = ({ className, size = 24, color, withBackground = false }) => {
  const iconContent = (
    <g fill={color || 'currentColor'}>
      {/* 1. Asas externas dobradas simétricas (esquerda e direita) com contorno em diamante */}
      {/* Asa esquerda */}
      <polygon points="50,15 19,46 29,56 20,65 40,85 47,78 47,38 31,54 28,51 50,29" />
      {/* Asa direita (espelhada) */}
      <polygon points="50,15 81,46 71,56 80,65 60,85 53,78 53,38 69,54 72,51 50,29" />

      {/* 2. Elemento central superior em dobra geométrica (fold) */}
      <polygon points="50,33 63,46 56,53 50,47 44,53 37,46" />

      {/* 3. Base das asas laterais inferiores com encaixe em notch */}
      <polygon points="47,46 47,84 41,78 41,52" />
      <polygon points="53,46 53,84 59,78 59,52" />
    </g>
  )

  if (withBackground) {
    return (
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn('shrink-0 select-none', className)}
        aria-hidden="true"
      >
        {/* Círculo de fundo azul-marinho escuro oficial da marca */}
        <circle cx="50" cy="50" r="49" fill="#002244" />
        {/* Símbolo geométrico branco centralizado */}
        <g fill="#FFFFFF">
          <polygon points="50,15 19,46 29,56 20,65 40,85 47,78 47,38 31,54 28,51 50,29" />
          <polygon points="50,15 81,46 71,56 80,65 60,85 53,78 53,38 69,54 72,51 50,29" />
          <polygon points="50,33 63,46 56,53 50,47 44,53 37,46" />
          <polygon points="47,46 47,84 41,78 41,52" />
          <polygon points="53,46 53,84 59,78 59,52" />
        </g>
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 select-none', className)}
      aria-hidden="true"
    >
      {iconContent}
    </svg>
  )
}

/**
 * Componente principal da Logo da Rumo Contábil
 * Apresenta o círculo azul-marinho escuro com o símbolo geométrico branco oficial da marca
 */
export const RumoLogo: React.FC<RumoLogoProps> = ({
  size = 40,
  iconOnly = false,
  variant = 'dark',
  title = 'Rumo',
  subtitle = 'Consultoria Contábil',
  hideSubtitle = false,
  badgeStyle = 'navy',
  badgeClassName,
  className,
  ...props
}) => {
  // Proporção do símbolo interno em relação ao container circular
  const innerIconSize = Math.round(size * 0.76)

  const getBadgeStyleClass = () => {
    switch (badgeStyle) {
      case 'none':
        return 'bg-transparent text-white'
      case 'teal':
        // Azul petróleo navy com brilho sutil
        return 'bg-gradient-to-tr from-[#002244] to-[#0B2C56] text-white shadow-md ring-1 ring-white/10'
      case 'flat-dark':
        return 'bg-[#002244] text-white border border-[#123B6D]/60 shadow-sm'
      case 'gradient':
        return 'bg-gradient-to-tr from-[#001D3D] via-[#002244] to-[#0A2E5C] text-white shadow-md ring-1 ring-white/10'
      case 'navy':
      default:
        // Círculo sólido azul marinho escuro (#002244) conforme imagem oficial enviada
        return 'bg-[#002244] text-white shadow-md ring-1 ring-white/10'
    }
  }

  const isLight = variant === 'light'
  const isMono = variant === 'monochrome-white'

  return (
    <div
      className={cn('flex items-center gap-3 overflow-hidden select-none', className)}
      {...props}
    >
      {/* Insígnia Circular da Marca Oficial Rumo */}
      <div
        style={{ width: size, height: size }}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full transition-all overflow-hidden',
          getBadgeStyleClass(),
          badgeClassName,
        )}
      >
        <RumoIcon size={innerIconSize} color="#FFFFFF" />
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

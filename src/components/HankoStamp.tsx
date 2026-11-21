import React from 'react'
import { cn } from '@/lib/utils'
import logoUrl from '@/assets/logo-fundo-transp-4b2b2.png'

/**
 * MARCA SIMPLIFICADA (estilo hanko do folder de graduação).
 *
 * Selo vermelho com cantos levemente rotacionados (como um carimbo) e o
 * kanji 柔 ("suave", de judô) em branco no centro. Foi desenhada para ser
 * LEGÍVEL em 24–48px — o dragão detalhado do logo oficial virava "apenas
 * bolinhas num fundo vermelho" nesses tamanhos.
 *
 * O nome "Judô Tatsu" NUNCA vai dentro da imagem: é escrito em texto ao
 * lado (Header/Footer) para nada aparecer cortado.
 */
export const HankoBrand: React.FC<{ className?: string; title?: string }> = ({
  className,
  title = 'Judô Tatsu',
}) => {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      className={cn('shrink-0 select-none', className)}
    >
      <title>{title}</title>
      <defs>
        {/* Tinta do selo: vermelho vivo com variação sutil de pincel */}
        <radialGradient id="hanko-brush" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#D33A3F" />
          <stop offset="55%" stopColor="#C1272D" />
          <stop offset="100%" stopColor="#9E1B20" />
        </radialGradient>
      </defs>

      {/* Corpo do selo: quadrado de cantos suaves, levemente rotacionado */}
      <rect
        x="3"
        y="3"
        width="42"
        height="42"
        rx="9"
        transform="rotate(-3 24 24)"
        fill="url(#hanko-brush)"
      />

      {/* Pontas irregulares de pincelada (massa de tinta saindo das bordas) */}
      <g fill="#C1272D">
        <rect x="1.5" y="14" width="4" height="9" rx="2" transform="rotate(-3 24 24)" />
        <rect x="42.5" y="26" width="4" height="9" rx="2" transform="rotate(-3 24 24)" />
        <rect x="14" y="1.5" width="9" height="4" rx="2" transform="rotate(-3 24 24)" />
        <rect x="25" y="42.5" width="9" height="4" rx="2" transform="rotate(-3 24 24)" />
      </g>

      {/* Rugas de tinta: traços claros, como a secagem do carimbo */}
      <g stroke="#E4636A" strokeWidth="0.9" opacity="0.55" strokeLinecap="round">
        <line x1="8" y1="15.5" x2="21" y2="15.5" />
        <line x1="27" y1="33.5" x2="40" y2="33.5" />
      </g>

      {/* Kanji 柔 (ju = "suave", de judô), estilizado traço a traço. */}
      <g fill="#FFFFFF">
        {/* Traço superior curto (cabeça do 矛) */}
        <path d="M23 7.6h2c0.6 0 0.6 1.4 0 1.4h-2c-0.6 0-0.6-1.4 0-1.4z" />
        {/* Duas barras horizontais do topo */}
        <path d="M17.4 10.5h13.2c0.5 0 0.5 1.7 0 1.7H17.4c-0.5 0-0.5-1.7 0-1.7z" />
        <path d="M15.6 13.6h16.8c0.5 0 0.5 1.7 0 1.7H15.6c-0.5 0-0.5-1.7 0-1.7z" />
        {/* Braços em diagonal que descem do topo (え do 矛) */}
        <path
          d="M20.7 11.4c-0.9 2.5-2.6 4.6-5.5 6.3-0.6 0.4-1.2-0.5-0.6-0.9 2.5-1.5 4-3.3 4.8-5.7 0.2-0.6 1.5-0.3 1.3 0.3z"
          fillOpacity="0.95"
        />
        <path
          d="M27.3 11.4c0.8 2.4 2.3 4.2 4.8 5.7 0.6 0.4 0 1.3-0.6 0.9-2.9-1.7-4.6-3.8-5.5-6.3-0.2-0.6 1.1-0.9 1.3-0.3z"
          fillOpacity="0.95"
        />
        {/* 馬 (parte inferior): coluna vertical + três barras */}
        <path d="M23.1 17.5h1.8v13.2h-1.8z" />
        <path d="M18.9 19.5h10.2c0.5 0 0.5 1.5 0 1.5H18.9c-0.5 0-0.5-1.5 0-1.5z" />
        <path d="M18.9 23.4h10.2c0.5 0 0.5 1.5 0 1.5H18.9c-0.5 0-0.5-1.5 0-1.5z" />
        <path d="M18.9 27.3h10.2c0.5 0 0.5 1.5 0 1.5H18.9c-0.5 0-0.5-1.5 0-1.5z" />
        {/* Pernas inferiores do 馬, em leque */}
        <path d="M18.7 30.3 15.2 35.6c-0.35 0.55-1.4 0-1.05-0.55l3.5-5.3c0.35-0.55 1.4 0.3 1.05 0.55z" />
        <path d="M21.2 30.6h1.6v5.6h-1.6z" />
        <path d="M25.2 30.6h1.6v5.6h-1.6z" />
        <path d="M29.3 30.3 32.8 35.6c0.35 0.55-0.7 1.1-1.05 0.55l-3.5-5.3c-0.35-0.55 0.7-1.4 1.05-0.55z" />
      </g>
    </svg>
  )
}

interface HankoStampProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  /** Mantido por compatibilidade e ignorado. */
  kanji?: string
  /** Texto do tooltip (marca da academia). */
  text?: string
}

const sizeMap = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
}

/**
 * Selo da academia em qualquer tamanho. Desde o refinamento da identidade
 * visual usa a MARCA SIMPLIFICADA (kanji 柔 em selo hanko) — o dragão
 * detalhado do logo oficial ficava irreconhecível em tamanhos pequenos
 * ("apenas bolinhas num fundo vermelho") e o PNG com o texto "JUDÔ TATSU"
 * embaixo aparecia cortado.
 */
export const HankoStamp: React.FC<HankoStampProps> = ({ size = 'md', className, text }) => {
  return (
    <HankoBrand
      title={text || 'Judô Tatsu'}
      className={cn(sizeMap[size], 'rounded-lg', className)}
    />
  )
}

export const ProductPlaceholder: React.FC<{ name?: string; className?: string }> = ({
  name,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 text-[#6B6560] h-full w-full min-h-[180px] bg-[#FAF6F0]',
        className,
      )}
    >
      <HankoBrand className="w-12 h-12 opacity-60" />
      <span className="font-serif text-xs opacity-80">{name || 'Produto do Judô Tatsu'}</span>
    </div>
  )
}

/** PNG oficial (dragão), para usos em tamanho GRANDE, quando fica bem renderizado. */
export const officialLogoUrl = logoUrl

export const OfficialLogo: React.FC<{ className?: string; alt?: string }> = ({
  className,
  alt = 'Logo do Judô Tatsu',
}) => (
  <img
    src={officialLogoUrl}
    alt={alt}
    className={cn('object-contain select-none', className)}
    draggable={false}
  />
)

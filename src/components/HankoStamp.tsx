import React from 'react'
import { cn } from '@/lib/utils'
import logoUrl from '@/assets/logo-fundo-transp-4b2b2.png'

/**
 * LOGO OFICIAL (dragão) — única marca do app, em todos os tamanhos.
 *
 * O PNG original (1163x1163, fundo transparente) tem o texto "JUDÔ TATSU"
 * na faixa inferior, que o usuário pediu para NÃO exibir: mesmo com
 * recortes anteriores (78% e depois 70% visíveis) o topo das letras
 * aparecia apagado, sem contraste contra fundos claros e escuros. O
 * recorte atual mostra apenas os 55% SUPERIORES da arte — a faixa de
 * texto inteira fica MUITO fora do quadro em qualquer escala, e as
 * pinceladas do dragão concentram-se no terço médio/superior, então nada
 * importante se perde. Só o dragão é renderizado.
 *
 * Cálculo: para mostrar 55% da altura, a imagem precisa ter 100/55 ≈
 * 181.82% da largura do quadro; o deslocamento horizontal de -18.2%
 * (metade dos 36.4% excedentes, relativo à própria largura da imagem)
 * mantém a arte centrada sem distorção.
 */
export const OfficialLogo: React.FC<{ className?: string; alt?: string }> = ({
  className,
  alt = 'Logo do Judô Tatsu',
}) => {
  return (
    <span
      className={cn(
        'block aspect-square overflow-hidden shrink-0 select-none [&>img]:w-[181.82%] [&>img]:h-auto [&>img]:max-w-none [&>img]:-translate-x-[18.2%] [&>img]:object-contain',
        className,
      )}
      aria-label={alt}
      role="img"
    >
      <img src={logoUrl} alt="" draggable={false} />
    </span>
  )
}

/** URL bruta do PNG oficial (para favicon, og:image etc.). */
export const officialLogoUrl = logoUrl

/** Tamanhos padronizados do logo na interface. */
const sizeMap = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
}

interface HankoStampProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  /** Mantido por compatibilidade e ignorado. */
  kanji?: string
  /** Texto alternativo (marca da academia). */
  text?: string
}

/**
 * Marca da academia em qualquer tamanho. Exibe o LOGO OFICIAL (dragão) —
 * em nenhum lugar do app o antigo selo hanko substitui o logo.
 */
export const HankoStamp: React.FC<HankoStampProps> = ({ size = 'md', className, text }) => {
  return <OfficialLogo className={cn(sizeMap[size], className)} alt={text || 'Judô Tatsu'} />
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
      <OfficialLogo className="w-12 h-12 opacity-80" />
      <span className="font-serif text-xs opacity-80">{name || 'Produto do Judô Tatsu'}</span>
    </div>
  )
}

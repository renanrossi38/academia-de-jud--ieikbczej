import React from 'react'
import { cn } from '@/lib/utils'
import logoUrl from '@/assets/logo-fundo-transp-4b2b2.png'

interface HankoStampProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  /** Mantido por compatibilidade: agora o selo usa o logo oficial do dragão. */
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
 * Selo da academia. Com o rebranding passou a exibir o LOGO OFICIAL do
 * Judô Tatsu (dragão vermelho sobre a estrela/sakura) em vez do kanji 柔.
 */
export const HankoStamp: React.FC<HankoStampProps> = ({ size = 'md', className, text }) => {
  return (
    <div
      title={text || 'Judô Tatsu'}
      className={cn(
        'flex items-center justify-center rounded-full bg-white ring-1 ring-[#1C1B1A]/10 overflow-hidden',
        sizeMap[size],
        className,
      )}
    >
      <img
        src={logoUrl}
        alt="Judô Tatsu"
        className="w-full h-full object-contain select-none"
        draggable={false}
      />
    </div>
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
      <img src={logoUrl} alt="Judô Tatsu" className="w-12 h-12 opacity-60" draggable={false} />
      <span className="font-serif text-xs opacity-80">{name || 'Produto do Judô Tatsu'}</span>
    </div>
  )
}
